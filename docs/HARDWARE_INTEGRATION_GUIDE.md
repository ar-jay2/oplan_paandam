# OPLAN PA-ANDAM: Hardware Integration & Firmware Architecture Guide
**A Resilient Multi-Protocol IoT Framework for Real-Time Flood Monitoring**
*Aklan State University – Ibajay Campus (Ibajay, Aklan, Philippines)*

---

## 1. System Topology & Dual-Pathway Redundancy

```
+---------------------------+        433 MHz LoRa        +-----------------------------------------------+
|         ESP32 #1          |  =======================>  |                   ESP32 #2                    |
| (Transmitter / Riverbed)  |   RA-02 Packet Broadcast   |             (Dual-Pathway Gateway)            |
|   - JSN-SR04T Ultrasonic  |                            +-----------------------------------------------+
|   - RA-02 433MHz LoRa     |                                   | (Synchronous UART2)   | (Async Wi-Fi)
+---------------------------+                                   | GPIO27 TX             | HTTP POST
                                                                v                       v
                                                   +-------------------------+  +------------------------+
                                                   |       Arduino UNO       |  |  Supabase Cloud &      |
                                                   |  - 16x2 / TFT Display   |  |  Web SCADA Dashboard   |
                                                   |  - Green Relay (≥20cm)  |  +------------------------+
                                                   |  - Yellow Relay (≥50cm) |
                                                   |  - Red Relay (≥80cm)    |
                                                   +-------------------------+
```

---

## 2. Hardware Wiring & Pin Mapping

### A. ESP32 #2 (Receiver & Gateway) Pin Map
| Peripheral | Pin Name / Function | ESP32 GPIO Pin | Destination / Wiring Notes |
| :--- | :--- | :--- | :--- |
| **Arduino UNO** | **UART2 TX** | **GPIO27** | Connect to Arduino UNO **RX (Pin 0)** or SoftwareSerial Pin |
| **RA-02 LoRa** | NSS / CS | GPIO5 | SPI Chip Select |
| **RA-02 LoRa** | SCK | GPIO18 | SPI Clock |
| **RA-02 LoRa** | MISO | GPIO19 | SPI Master In / Slave Out |
| **RA-02 LoRa** | MOSI | GPIO23 | SPI Master Out / Slave In |
| **RA-02 LoRa** | DIO0 | GPIO2 | LoRa Packet Interrupt |
| **RA-02 LoRa** | RST | GPIO14 | LoRa Reset |

> **CRITICAL RULE**: Do NOT change GPIO27 or LoRa pins. The UART2 connection on GPIO27 must remain 115200 baud to ensure complete backward compatibility with the existing Arduino UNO TFT and relay shield.

---

## 3. ESP32 #2 FreeRTOS Dual-Core Firmware Code

To guarantee that Wi-Fi reconnections or cloud network latency **never** block local LoRa packet reception or relay triggers on the Arduino UNO, this firmware leverages the ESP32's dual Xtensa cores via FreeRTOS:

- **Core 1 (Real-Time Hydrology Loop)**: Dedicated to SPI LoRa parsing and immediate UART2 transmission to Arduino UNO on GPIO27.
- **Core 0 (Telemetry Cloud Worker)**: Consumes packets from a thread-safe FreeRTOS queue and posts them asynchronously to the Supabase Edge Function over Wi-Fi.

```cpp
/**
 * OPLAN PA-ANDAM: ESP32 #2 Dual-Pathway Gateway Firmware
 * Aklan State University - Ibajay Campus
 */

#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <HTTPClient.h>

// --- Configuration ---
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* INGEST_URL    = "https://<your-supabase-ref>.supabase.co/functions/v1/ingest-flood-telemetry";
const char* GATEWAY_SECRET = "pa_andam_sec_99a8b7c6d5e4"; // Match secret in Supabase Vault
const char* NODE_CODE     = "PA-ANDAM-001";

// --- Hardware Pins ---
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23
#define LORA_CS    5
#define LORA_RST   14
#define LORA_DIO0  2
#define UNO_TX_PIN 27 // UART2 TX to Arduino UNO

HardwareSerial UnoSerial(2);

// Thread-safe queue for telemetry decoupling
struct TelemetryPacket {
  char packetStr[64];
  int rssi;
  float snr;
};

QueueHandle_t telemetryQueue;

// Task on Core 0: Wi-Fi HTTP Uploader
void CloudWorkerTask(void * pvParameters) {
  TelemetryPacket item;
  for (;;) {
    if (xQueueReceive(telemetryQueue, &item, portMAX_DELAY) == pdTRUE) {
      if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(INGEST_URL);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("x-gateway-secret", GATEWAY_SECRET);

        // Build JSON payload
        String jsonPayload = "{";
        jsonPayload += "\"node_code\":\"" + String(NODE_CODE) + "\",";
        jsonPayload += "\"packet\":\"" + String(item.packetStr) + "\",";
        jsonPayload += "\"rssi\":" + String(item.rssi) + ",";
        jsonPayload += "\"snr\":" + String(item.snr);
        jsonPayload += "}";

        int httpResponseCode = http.POST(jsonPayload);
        if (httpResponseCode > 0) {
          Serial.printf("[CloudWorker] Post OK (Code %d)\\n", httpResponseCode);
        } else {
          Serial.printf("[CloudWorker] HTTP POST failed: %s\\n", http.errorToString(httpResponseCode).c_str());
        }
        http.end();
      } else {
        Serial.println("[CloudWorker] Wi-Fi disconnected; local UNO unaffected.");
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  // Initialize UART2 TX on GPIO27 for Arduino UNO at 115200 baud
  UnoSerial.begin(115200, SERIAL_8N1, -1, UNO_TX_PIN);
  Serial.println("[Init] UART2 TX initialized on GPIO27.");

  // Create Packet Queue (Capacity 16 packets)
  telemetryQueue = xQueueCreate(16, sizeof(TelemetryPacket));

  // Initialize SPI & LoRa (Core 1)
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(433E6)) {
    Serial.println("[Error] RA-02 LoRa initialization failed!");
    while (1);
  }
  LoRa.setSyncWord(0xF3); // Dedicated network synchronization word
  Serial.println("[Init] LoRa 433MHz Receiver Ready.");

  // Connect Wi-Fi in background
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Pin Cloud Worker to Core 0 (LoRa runs on Core 1 by default)
  xTaskCreatePinnedToCore(
    CloudWorkerTask,
    "CloudWorker",
    8192,
    NULL,
    1,
    NULL,
    0
  );
}

void loop() {
  // Real-Time Core 1 Execution
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String packetContent = "";
    while (LoRa.available()) {
      packetContent += (char)LoRa.read();
    }
    packetContent.trim();

    // 1. INSTANT LOCAL ACTION: Output to Arduino UNO over GPIO27
    // Arduino UNO immediately evaluates relays & updates local TFT display
    UnoSerial.println(packetContent);
    Serial.printf("[LoRa RX -> UNO]: %s\\n", packetContent.c_str());

    // 2. DISPATCH TO CLOUD QUEUE (Non-blocking)
    TelemetryPacket tp;
    strncpy(tp.packetStr, packetContent.c_str(), sizeof(tp.packetStr) - 1);
    tp.packetStr[sizeof(tp.packetStr) - 1] = '\\0';
    tp.rssi = LoRa.packetRssi();
    tp.snr  = LoRa.packetSnr();

    xQueueSend(telemetryQueue, &tp, (TickType_t)0);
  }
}
```

---

## 4. Local Relay Threshold Calibration (Arduino UNO)

The Arduino UNO receives the line over UART and updates the physical indicators according to these exact conditions:

- **Inactive / De-energized**: Water level < 20.0 cm OR sensor is offline.
- **Green Relay (PIN 8)**: Active when $20.0\text{ cm} \le \text{Water Level} < 50.0\text{ cm}$.
- **Yellow Relay (PIN 9)**: Active when $50.0\text{ cm} \le \text{Water Level} < 80.0\text{ cm}$.
- **Red Relay & Buzzer (PIN 10)**: Active when $\text{Water Level} \ge 80.0\text{ cm}$.

---

## 5. Deployment & Testing Checklist

- [x] **Database Migration**: Run `20261014000000_flood_monitoring_schema.sql` in Supabase SQL Editor.
- [x] **Edge Function Deploy**: Deploy `ingest-flood-telemetry` with `GATEWAY_SECRET` environment variable.
- [x] **ESP32 #2 Bench Test**: Verify that disconnecting Wi-Fi does **not** interrupt UART transmission on GPIO27.
- [x] **Telemetry Source Transparency**: Ensure website dashboard correctly reflects `REAL HARDWARE DATA` only after true ESP32 packets are confirmed in `flood_readings`.
- [x] **Relay Safety Boundary**: Verify that no remote website control can disable physical emergency relays.
