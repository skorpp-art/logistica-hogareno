import { NextRequest, NextResponse } from "next/server";

// Modelos en orden de preferencia: si uno falla (retirado/no disponible), se prueba el siguiente
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
];

const PROMPT = `Sos un lector experto de etiquetas de envío argentinas (Mercado Libre Flex, Correo Argentino, OCA, Andreani, etc).

Leé esta imagen de etiqueta de paquete y extraé la información. Devolvé ÚNICAMENTE un JSON válido con esta estructura:

{
  "destinatario": "nombre y apellido completo del destinatario/receptor del paquete (en ML Flex aparece abajo como 'Destinatario: ...')",
  "direccion_completa": "dirección COMPLETA incluyendo calle, número, piso/depto si hay, barrio/localidad, partido y provincia. Todo junto separado por comas",
  "calle": "solo la calle con número (ej: Calle Bulnes 1016)",
  "localidad": "barrio o localidad (ej: Almagro, Villa Raffo)",
  "partido": "partido, municipio o CABA (ej: Tres de Febrero, CABA)",
  "provincia": "provincia (ej: Buenos Aires). Si dice CABA, poné 'CABA'",
  "codigo_postal": "código postal si aparece (ej: 1176)",
  "numero_envio": "el número de envío/tracking principal. En ML Flex aparece como 'Envío: 4732756 0308' — incluí TODOS los dígitos tal como aparecen",
  "pack_id": "número de Pack ID si aparece (ej: 'Pack ID: 20000 13580187401'), diferente al número de envío",
  "fecha": "fecha que aparezca en la etiqueta (ej: 18 JUN)",
  "telefono": "teléfono del destinatario si aparece",
  "remitente": "nombre del remitente/vendedor (en ML Flex aparece ARRIBA de todo con su dirección)",
  "peso": "peso del paquete si aparece",
  "notas": "referencia de entrega, entre calles, tipo de envío (FLEX/RESIDENCIAL), y cualquier otra información útil. Ej: 'Referencia: casa amarilla puerta hierro. Entre: Tucumán y Lavalle. FLEX RESIDENCIAL'"
}

REGLAS IMPORTANTES:
- Leé TODO el texto visible en la etiqueta, incluso si está en ángulo, arrugada o parcialmente visible
- En etiquetas ML Flex: el REMITENTE está arriba (junto a Envío y Pack ID), el DESTINATARIO está abajo (Dirección, Barrio, Referencia, Entre calles)
- NO confundas remitente con destinatario
- La dirección completa debe ser la de ENTREGA (la de abajo), no la del remitente
- El número de envío puede tener espacios (ej: '4732756 0308') — copialo completo
- NO confundas números de envío/pack con números de teléfono
- La REFERENCIA y ENTRE CALLES son muy importantes para el chofer: ponelas en notas
- Si un campo no aparece dejalo como string vacío ""
- Respondé SOLO el JSON, sin explicaciones, sin markdown, sin backticks`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY no configurada. Agregá GEMINI_API_KEY en las variables de entorno de Vercel (Settings → Environment Variables) y redeployá." },
      { status: 500 }
    );
  }

  try {
    const { image, mediaType } = await req.json();

    if (!image) {
      return NextResponse.json({ error: "No se recibió imagen" }, { status: 400 });
    }

    const finalMediaType = mediaType || "image/jpeg";
    const body = JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: finalMediaType,
                data: image,
              },
            },
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    });

    let lastError = "";
    for (const model of GEMINI_MODELS) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`Gemini API error (${model}):`, response.status, errorData);
        lastError = `${response.status} - ${errorData.substring(0, 300)}`;
        // 404 = modelo no existe/retirado → probar el siguiente. Otros errores también reintentan con el siguiente modelo.
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      let parsed;
      try {
        const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            lastError = "Respuesta de IA no parseable";
            continue;
          }
        } else {
          lastError = "No se pudo extraer datos de la imagen";
          continue;
        }
      }

      return NextResponse.json({ success: true, data: parsed, model });
    }

    return NextResponse.json(
      { error: `No se pudo leer la etiqueta. Último error: ${lastError}` },
      { status: 502 }
    );
  } catch (err) {
    console.error("Error processing label:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}
