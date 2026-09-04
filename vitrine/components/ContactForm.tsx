"use client";

import { useState, type FormEvent } from "react";
import { useT } from "@/lib/i18n";

type Status = "idle" | "loading" | "success" | "error";

export function ContactForm() {
  const t = useT();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.error || t("contact_erreur_generique"));
      }
      setStatus("success");
      form.reset();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t("contact_erreur_generique"));
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-red/20 bg-red/5 p-8 text-center">
        <h3 className="text-lg font-semibold text-ink">{t("contact_merci_titre")}</h3>
        <p className="mt-2 text-sm text-text-muted">
          {t("contact_merci_texte")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-sm font-medium text-ink">
            {t("nom_complet_label")}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1.5 w-full rounded-md border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-red"
          />
        </div>
        <div>
          <label htmlFor="company" className="text-sm font-medium text-ink">
            {t("entreprise_label")}
          </label>
          <input
            id="company"
            name="company"
            type="text"
            className="mt-1.5 w-full rounded-md border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-red"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="text-sm font-medium text-ink">
            {t("courriel_label")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1.5 w-full rounded-md border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-red"
          />
        </div>
        <div>
          <label htmlFor="phone" className="text-sm font-medium text-ink">
            {t("telephone_label_vitrine")}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="mt-1.5 w-full rounded-md border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-red"
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="text-sm font-medium text-ink">
          {t("message_label")}
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          minLength={10}
          placeholder={t("message_placeholder")}
          className="mt-1.5 w-full resize-none rounded-md border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-red"
        />
        <p className="mt-1 text-xs text-text-muted">{t("minimum_10_caracteres")}</p>
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex w-full items-center justify-center rounded-md bg-red px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-red-bright disabled:opacity-60 sm:w-auto"
      >
        {status === "loading" ? t("envoi_en_cours_vitrine") : t("demarrer_essai_gratuit")}
      </button>

      {status === "error" && (
        <p className="text-sm text-red">{errorMessage}</p>
      )}
    </form>
  );
}
