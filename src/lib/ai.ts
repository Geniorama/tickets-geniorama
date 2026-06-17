import { GoogleGenAI, type FunctionDeclaration } from "@google/genai";
import OpenAI from "openai";

// ─── Proveedores ────────────────────────────────────────────────────────────

export type AiProvider = "gemini" | "openai";

export const GEMINI_MODEL = "gemini-2.5-flash";
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function isValidProvider(p: unknown): p is AiProvider {
  return p === "gemini" || p === "openai";
}

/** Devuelve un mensaje de error si el proveedor no está configurado, o null. */
export function providerConfigError(provider: AiProvider): string | null {
  if (provider === "openai" && !process.env.OPENAI_API_KEY) {
    return "OpenAI no está configurado (falta OPENAI_API_KEY).";
  }
  if (provider === "gemini" && !process.env.GOOGLE_AI_API_KEY) {
    return "Gemini no está configurado (falta GOOGLE_AI_API_KEY).";
  }
  return null;
}

let _openai: OpenAI | null = null;
function openaiClient(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

let _gemini: GoogleGenAI | null = null;
function geminiClient(): GoogleGenAI {
  if (!_gemini) {
    _gemini = new GoogleGenAI({
      apiKey: process.env.GOOGLE_AI_API_KEY!,
      httpOptions: { baseUrl: "https://generativelanguage.googleapis.com" },
    });
  }
  return _gemini;
}

// ─── Chat con herramientas (function-calling) ────────────────────────────────

export type ChatMsg = { role: "user" | "assistant"; text: string };
export type ToolCall = { name: string; args: Record<string, unknown> };

export async function runAssistantChat(opts: {
  provider: AiProvider;
  system: string;
  messages: ChatMsg[];
  geminiTools: { functionDeclarations: FunctionDeclaration[] }[];
  openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[];
}): Promise<{ text: string; toolCalls: ToolCall[] }> {
  if (opts.provider === "openai") {
    const client = openaiClient();
    const res = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: opts.system },
        ...opts.messages.map((m) => ({ role: m.role, content: m.text })),
      ],
      tools: opts.openaiTools,
      tool_choice: "auto",
    });
    const msg = res.choices[0]?.message;
    const toolCalls: ToolCall[] = (msg?.tool_calls ?? []).flatMap((tc) => {
      if (tc.type !== "function") return [];
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignorar */ }
      return [{ name: tc.function.name, args }];
    });
    return { text: msg?.content ?? "", toolCalls };
  }

  // Gemini
  const ai = geminiClient();
  const contents = opts.messages.map((m) => ({
    role: (m.role === "assistant" ? "model" : "user") as "model" | "user",
    parts: [{ text: m.text }],
  }));
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: { systemInstruction: opts.system, tools: opts.geminiTools },
  });
  const toolCalls: ToolCall[] = (response.functionCalls ?? []).map((c) => ({
    name: c.name ?? "",
    args: c.args ?? {},
  }));
  return { text: response.text ?? "", toolCalls };
}

// ─── Salida JSON estructurada (con documento opcional) ───────────────────────

export async function runStructuredJson(opts: {
  provider: AiProvider;
  prompt: string;
  pdfBase64?: string;
  /** Esquema nativo de Gemini (Type-based). OpenAI usa modo json_object guiado por el prompt. */
  geminiResponseSchema: unknown;
}): Promise<string> {
  if (opts.provider === "openai") {
    const client = openaiClient();
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: opts.prompt },
    ];
    if (opts.pdfBase64) {
      content.push({
        type: "file",
        file: { filename: "documento.pdf", file_data: `data:application/pdf;base64,${opts.pdfBase64}` },
      });
    }
    const res = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    });
    return res.choices[0]?.message?.content ?? "";
  }

  // Gemini
  const ai = geminiClient();
  const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [
    { text: opts.prompt },
  ];
  if (opts.pdfBase64) parts.push({ inlineData: { mimeType: "application/pdf", data: opts.pdfBase64 } });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: opts.geminiResponseSchema as never,
    },
  });
  return response.text ?? "";
}
