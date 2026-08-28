import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8011";

function splitName(nomComplet: string) {
  const parts = nomComplet.trim().split(/\s+/);
  const prenom = parts.shift() || nomComplet;
  const nom = parts.length > 0 ? parts.join(" ") : prenom;
  return { prenom, nom };
}

function formatValidationErrors(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const entries = Object.entries(data as Record<string, unknown>);
  const messages: string[] = [];
  for (const [, value] of entries) {
    const detail = Array.isArray(value) ? value[0] : value;
    if (typeof detail === "string") messages.push(detail);
  }
  return messages.length > 0 ? messages.join(" ") : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.email !== "string" || typeof body.name !== "string") {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const { prenom, nom } = splitName(body.name);

  const res = await fetch(`${API_URL}/api/contact/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prenom,
      nom,
      email: body.email,
      message: body.message,
      entreprise: body.company || "",
      telephone: body.phone || "",
    }),
  }).catch(() => null);

  if (!res) {
    return NextResponse.json({ error: "Impossible de joindre le serveur pour le moment." }, { status: 502 });
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (res.status === 400) {
      const detail = formatValidationErrors(data);
      return NextResponse.json({ error: detail || "Certaines informations sont invalides." }, { status: 400 });
    }
    return NextResponse.json({ error: "Envoi impossible pour le moment." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
