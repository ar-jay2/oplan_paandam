
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-gateway-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const validStatuses = new Set(["NORMAL", "WARNING", "CRITICAL", "NO DATA"]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // 1. Require a configured gateway secret.
    const configuredSecret = Deno.env.get("GATEWAY_SECRET");
    const incomingSecret = req.headers.get("x-gateway-secret");

    if (!configuredSecret) {
      console.error("GATEWAY_SECRET is not configured.");
      return jsonResponse({ error: "Gateway authentication is not configured" }, 500);
    }

    if (!incomingSecret || incomingSecret !== configuredSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // 2. Validate server-side database configuration.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      console.error("Supabase server configuration is missing.");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    // 3. Parse JSON.
    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (typeof body.node_code !== "string" || !body.node_code.trim()) {
      return jsonResponse({ error: "node_code is required" }, 400);
    }

    const nodeCode = body.node_code.trim();

    let waterLevel: number;
    let distanceCM: number;
    let sequenceNumber: number;
    let floodStatus: string;

    if (typeof body.packet === "string") {
      const parts = body.packet.trim().split(",");

      if (parts.length !== 5 || parts[0].trim() !== "PAANDAM") {
        return jsonResponse({ error: "Invalid PAANDAM packet format" }, 422);
      }

      waterLevel = Number(parts[1]);
      distanceCM = Number(parts[2]);
      floodStatus = parts[3].trim().toUpperCase();
      sequenceNumber = Number(parts[4]);
    } else {
      waterLevel = Number(body.water_level);
      distanceCM = Number(body.distance_cm);
      floodStatus =
        typeof body.flood_status === "string"
          ? body.flood_status.toUpperCase()
          : "";
      sequenceNumber = Number(body.sequence_number);
    }

    if (
      !Number.isFinite(waterLevel) ||
      !Number.isFinite(distanceCM) ||
      !Number.isSafeInteger(sequenceNumber) ||
      waterLevel < 0 || waterLevel > 100 ||
      distanceCM < 0 || distanceCM > 100 ||
      sequenceNumber < 0 ||
      !validStatuses.has(floodStatus)
    ) {
      return jsonResponse({ error: "Invalid telemetry values" }, 422);
    }

    const rssi = body.rssi == null ? null : Number(body.rssi);
    const snr = body.snr == null ? null : Number(body.snr);

    if (
      (rssi !== null && !Number.isFinite(rssi)) ||
      (snr !== null && !Number.isFinite(snr))
    ) {
      return jsonResponse({ error: "Invalid RSSI or SNR value" }, 422);
    }

    const sensorOnline =
      typeof body.sensor_online === "boolean"
        ? body.sensor_online
        : floodStatus !== "NO DATA";

    if (!sensorOnline && floodStatus !== "NO DATA") {
      floodStatus = "NO DATA";
    }

    // 4. Connect using the service-role key on the server only.
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 5. Confirm the node is registered and enabled.
    const { data: node, error: nodeError } = await supabase
      .from("flood_nodes")
      .select("id, enabled")
      .eq("node_code", nodeCode)
      .maybeSingle();

    if (nodeError) {
      console.error("Node lookup failed:", nodeError.message);
      return jsonResponse({ error: "Could not verify sensor node" }, 500);
    }

    if (!node) {
      return jsonResponse({ error: "Sensor node is not registered" }, 404);
    }

    if (!node.enabled) {
      return jsonResponse({ error: "Sensor node is disabled" }, 403);
    }

    // 6. Read previous status for transition detection.
    const { data: previous, error: previousError } = await supabase
      .from("flood_readings")
      .select("flood_status")
      .eq("node_id", node.id)
      .order("received_at", { ascending: false })
      .limit(1);

    if (previousError) {
      console.error("Previous reading lookup failed:", previousError.message);
      return jsonResponse({ error: "Could not read previous telemetry" }, 500);
    }

    const previousStatus = previous?.[0]?.flood_status ?? null;
    const receivedAt = new Date().toISOString();

    // 7. Insert the new reading.
    const { data: reading, error: readingError } = await supabase
      .from("flood_readings")
      .insert({
        node_id: node.id,
        water_level: waterLevel,
        distance_cm: distanceCM,
        flood_status: floodStatus,
        sequence_number: sequenceNumber,
        rssi,
        snr,
        sensor_online: sensorOnline,
        received_at: receivedAt,
      })
      .select("id")
      .single();

    if (readingError) {
      console.error("Reading insert failed:", readingError.message);
      return jsonResponse({ error: "Could not store telemetry reading" }, 500);
    }

    // 8. Record a status transition, if one occurred.
    let eventCreated = false;

    if (
      previousStatus !== null &&
      previousStatus !== floodStatus &&
      floodStatus !== "NO DATA"
    ) {
      const { error: eventError } = await supabase
        .from("flood_events")
        .insert({
          node_id: node.id,
          previous_status: previousStatus,
          new_status: floodStatus,
          water_level: waterLevel,
          event_time: receivedAt,
          acknowledged: false,
          notes: null,
        });

      if (eventError) {
        // The reading has already been stored. Report partial success
        // so the gateway knows the reading was accepted.
        console.error("Event insert failed:", eventError.message);

        return jsonResponse({
          success: true,
          reading_id: reading.id,
          transition_event_created: false,
          warning: "Reading saved, but event logging failed",
        }, 200);
      }

      eventCreated = true;
    }

    return jsonResponse({
      success: true,
      message: "Telemetry ingested successfully",
      reading_id: reading.id,
      transition_event_created: eventCreated,
    });
  } catch (error) {
    console.error("Unhandled ingestion error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
