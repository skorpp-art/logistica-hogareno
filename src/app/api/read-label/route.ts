import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY no configurada. Agregá ANTHROPIC_API_KEY en las variables de entorno de Vercel." },
      { status: 500 }
    );
  }

  try {
    const { image, mediaType } = await req.json();

    if (!image) {
      return NextResponse.json({ error: "No se recibió imagen" }, { status: 400 });
    }

    // Ensure valid media type for Anthropic API
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    let finalMediaType = mediaType || "image/jpeg";
    if (!validTypes.includes(finalMediaType)) {
      finalMediaType = "image/jpeg";
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: finalMediaType,
                  data: image,
                },
              },
              {
                type: "text",
                text: `Sos un lector experto de etiquetas de envío argentinas (Mercado Libre Flex, Correo Argentino, OCA, Andreani, etc).

Leé esta imagen de etiqueta de paquete y extraé la información. Devolvé ÚNICAMENTE un JSON válido con esta estructura:

{
  "destinatario": "nombre y apellido completo del destinatario/receptor del paquete",
  "direccion_completa": "dirección COMPLETA incluyendo calle, número, piso/depto si hay, localidad, partido y provincia. Todo junto separado por comas",
  "calle": "solo la calle con número (ej: Calle Chile 1158)",
  "localidad": "barrio o localidad (ej: Villa Raffo)",
  "partido": "partido o municipio (ej: Tres de Febrero)",
  "provincia": "provincia (ej: Buenos Aires)",
  "codigo_postal": "código postal si aparece",
  "numero_envio": "el número de envío/tracking/seguimiento principal - es el ID más importante del paquete",
  "pack_id": "número de pack si es diferente al número de envío",
  "fecha": "fecha que aparezca en la etiqueta (de despacho, impresión o entrega)",
  "telefono": "teléfono del destinatario si aparece",
  "remitente": "nombre del remitente/vendedor/quien envía",
  "peso": "peso del paquete si aparece",
  "notas": "cualquier otra información relevante visible en la etiqueta"
}

REGLAS IMPORTANTES:
- Leé TODO el texto visible en la etiqueta, incluso si está en ángulo o parcialmente visible
- La dirección completa debe incluir calle+número, localidad, partido/ciudad y provincia
- El número de envío suele ser el número más largo y prominente (ej: 12291407575)
- NO confundas números de envío/pack con números de teléfono
- Si hay texto como "Pack: 12345" o "Envío: 12345", esos son los IDs
- Si un campo no aparece dejalo como string vacío ""
- Respondé SOLO el JSON, sin explicaciones ni markdown`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Anthropic API error:", response.status, errorData);
      return NextResponse.json(
        { error: `Error de la API de IA: ${response.status} - ${errorData.substring(0, 200)}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return NextResponse.json(
          { error: "No se pudo extraer datos de la imagen", raw: text },
          { status: 422 }
        );
      }
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    console.error("Error processing label:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}
