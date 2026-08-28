"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "loading" | "success" | "error";

export function ContactForm() {
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
        throw new Error(result?.error || "Une erreur est survenue. Veuillez réessayer ou nous joindre directement.");
      }
      setStatus("success");
      form.reset();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Une erreur est survenue. Veuillez réessayer ou nous joindre directement.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-red/20 bg-red/5 p-8 text-center">
        <h3 className="text-lg font-semibold text-ink">Merci !</h3>
        <p className="mt-2 text-sm text-text-muted">
          Votre demande a bien été envoyée. Notre équipe vous répondra sous
          peu.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-sm font-medium text-ink">
            Nom complet
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
            Entreprise
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
            Courriel
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
            Téléphone
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
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          minLength={10}
          placeholder="Parlez-nous de votre entreprise et de vos besoins d'inspection..."
          className="mt-1.5 w-full resize-none rounded-md border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-red"
        />
        <p className="mt-1 text-xs text-text-muted">Minimum 10 caractères.</p>
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex w-full items-center justify-center rounded-md bg-red px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-red-bright disabled:opacity-60 sm:w-auto"
      >
        {status === "loading" ? "Envoi en cours..." : "Démarrer l'essai gratuit"}
      </button>

      {status === "error" && (
        <p className="text-sm text-red">{errorMessage}</p>
      )}
    </form>
  );
}
