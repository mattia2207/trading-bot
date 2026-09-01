import { createHmac } from "node:crypto";
import axios from "axios";

export interface BrokerOrder {
  status: "FILLED";
  exchangeOrderId: string | null;
  rawResponse: Record<string, unknown>;
}

export interface LongBroker {
  placeLongMarket(symbol: string, quantity: number): Promise<BrokerOrder>;
}

export class PaperBroker implements LongBroker {
  async placeLongMarket(symbol: string, quantity: number): Promise<BrokerOrder> {
    return {
      status: "FILLED",
      exchangeOrderId: null,
      rawResponse: { broker: "paper", symbol, quantity },
    };
  }
}

export class BinanceTestnetBroker implements LongBroker {
  private readonly key = process.env.BINANCE_TESTNET_API_KEY ?? "";
  private readonly secret = process.env.BINANCE_TESTNET_API_SECRET ?? "";
  private readonly baseUrl = "https://testnet.binance.vision";

  async placeLongMarket(symbol: string, quantity: number): Promise<BrokerOrder> {
    if (!this.key || !this.secret) {
      throw new Error("Credenziali Binance Spot Testnet mancanti.");
    }
    const params = new URLSearchParams({
      symbol: symbol.replace(/[/_-]/g, "").toUpperCase(),
      side: "BUY",
      type: "MARKET",
      quantity: quantity.toFixed(12),
      timestamp: String(Date.now()),
      recvWindow: "5000",
    });
    const signature = createHmac("sha256", this.secret)
      .update(params.toString())
      .digest("hex");
    const response = await axios.post(
      `${this.baseUrl}/api/v3/order?${params.toString()}&signature=${signature}`,
      undefined,
      { headers: { "X-MBX-APIKEY": this.key }, timeout: 10_000 },
    );
    return {
      status: "FILLED",
      exchangeOrderId: String(response.data.orderId ?? ""),
      rawResponse: response.data as Record<string, unknown>,
    };
  }
}

export function createBroker(mode: "paper" | "testnet"): LongBroker {
  return mode === "testnet" ? new BinanceTestnetBroker() : new PaperBroker();
}