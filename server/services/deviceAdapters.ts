/**
 * Device Adapter Interface for Biometric Attendance Devices
 * Supports pluggable adapters for different device manufacturers
 */

export interface DeviceLog {
  deviceId: string;
  employeeId: string;
  punchTime: Date;
  type: "check-in" | "check-out";
  raw?: any;
}

export interface DeviceAdapter {
  connect(config: any): Promise<boolean>;
  disconnect(): Promise<void>;
  fetchLogs(lastSyncTime?: Date): Promise<DeviceLog[]>;
  testConnection(): Promise<boolean>;
}

/**
 * ZKTeco Device Adapter
 * Supports ZKTeco biometric devices via TCP/IP
 */
export class ZKTecoAdapter implements DeviceAdapter {
  private config: any;
  private connected: boolean = false;

  async connect(config: any): Promise<boolean> {
    this.config = config;
    
    try {
      // In production, this would use ZKTeco SDK or TCP socket connection
      // For now, we'll simulate the connection
      console.log(`Connecting to ZKTeco device at ${config.ipAddress}:${config.port || 4370}`);
      
      // Simulated connection validation
      if (!config.ipAddress) {
        throw new Error("IP address is required for ZKTeco device");
      }
      
      this.connected = true;
      console.log(`ZKTeco device connected: ${config.name}`);
      return true;
    } catch (error: any) {
      console.error(`Failed to connect to ZKTeco device: ${error.message}`);
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log(`ZKTeco device disconnected: ${this.config?.name}`);
  }

  async testConnection(): Promise<boolean> {
    if (!this.connected) {
      return this.connect(this.config);
    }
    return true;
  }

  async fetchLogs(lastSyncTime?: Date): Promise<DeviceLog[]> {
    if (!this.connected) {
      throw new Error("Device not connected. Call connect() first.");
    }

    try {
      // In production, this would fetch from actual ZKTeco device
      // Using ZKTeco SDK commands or raw TCP protocol
      
      // Simulated log fetching for demonstration
      console.log(`Fetching logs from ZKTeco device since ${lastSyncTime?.toISOString() || 'beginning'}`);
      
      // Return empty array for now - in production this would return actual device logs
      // Example format:
      // return [
      //   { deviceId: this.config.id, employeeId: 'EMP001', punchTime: new Date(), type: 'check-in' },
      //   { deviceId: this.config.id, employeeId: 'EMP001', punchTime: new Date(), type: 'check-out' },
      // ];
      
      return [];
    } catch (error: any) {
      console.error(`Failed to fetch logs from ZKTeco device: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Suprema Device Adapter
 * Supports Suprema BioStar devices via HTTP API
 */
export class SupremaAdapter implements DeviceAdapter {
  private config: any;
  private connected: boolean = false;

  async connect(config: any): Promise<boolean> {
    this.config = config;
    
    try {
      console.log(`Connecting to Suprema device at ${config.ipAddress}`);
      
      // In production, this would use Suprema BioStar HTTP API
      // Authenticate with API key and test connection
      if (!config.ipAddress || !config.apiKey) {
        throw new Error("IP address and API key are required for Suprema device");
      }
      
      this.connected = true;
      console.log(`Suprema device connected: ${config.name}`);
      return true;
    } catch (error: any) {
      console.error(`Failed to connect to Suprema device: ${error.message}`);
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log(`Suprema device disconnected: ${this.config?.name}`);
  }

  async testConnection(): Promise<boolean> {
    if (!this.connected) {
      return this.connect(this.config);
    }
    return true;
  }

  async fetchLogs(lastSyncTime?: Date): Promise<DeviceLog[]> {
    if (!this.connected) {
      throw new Error("Device not connected. Call connect() first.");
    }

    try {
      console.log(`Fetching logs from Suprema device since ${lastSyncTime?.toISOString() || 'beginning'}`);
      
      // In production, this would call Suprema BioStar HTTP API
      // Example: GET /api/events?startTime={lastSyncTime}
      
      return [];
    } catch (error: any) {
      console.error(`Failed to fetch logs from Suprema device: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Generic HTTP Device Adapter
 * For devices with custom HTTP/REST APIs
 */
export class HttpDeviceAdapter implements DeviceAdapter {
  private config: any;
  private connected: boolean = false;

  async connect(config: any): Promise<boolean> {
    this.config = config;
    
    try {
      console.log(`Connecting to HTTP device at ${config.apiUrl}`);
      
      if (!config.apiUrl) {
        throw new Error("API URL is required for HTTP device");
      }
      
      // Test connection with a ping/health check endpoint if available
      this.connected = true;
      console.log(`HTTP device connected: ${config.name}`);
      return true;
    } catch (error: any) {
      console.error(`Failed to connect to HTTP device: ${error.message}`);
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log(`HTTP device disconnected: ${this.config?.name}`);
  }

  async testConnection(): Promise<boolean> {
    if (!this.connected) {
      return this.connect(this.config);
    }
    return true;
  }

  async fetchLogs(lastSyncTime?: Date): Promise<DeviceLog[]> {
    if (!this.connected) {
      throw new Error("Device not connected. Call connect() first.");
    }

    try {
      console.log(`Fetching logs from HTTP device since ${lastSyncTime?.toISOString() || 'beginning'}`);
      
      // In production, make HTTP request to custom endpoint
      // const response = await fetch(`${this.config.apiUrl}/logs?since=${lastSyncTime}`);
      
      return [];
    } catch (error: any) {
      console.error(`Failed to fetch logs from HTTP device: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Device Adapter Factory
 * Creates appropriate adapter based on device type
 */
export function createDeviceAdapter(deviceType: string): DeviceAdapter {
  switch (deviceType.toLowerCase()) {
    case "zkteco":
      return new ZKTecoAdapter();
    case "suprema":
      return new SupremaAdapter();
    case "http":
      return new HttpDeviceAdapter();
    default:
      throw new Error(`Unsupported device type: ${deviceType}`);
  }
}
