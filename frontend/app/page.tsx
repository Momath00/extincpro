import Link from 'next/link'
import PublicNavbar from '@/components/PublicNavbar'
import PublicFooter from '@/components/PublicFooter'
import ContactForm from '@/components/ContactForm'

const NAVY = '#0f172a'
const ORANGE = '#dc2626'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
      <PublicNavbar />

      {/* Hero — photo extincteur en fond, dégradé sombre, coupe diagonale */}
      <section
        className="relative overflow-hidden pt-16 pb-28 md:pt-24 md:pb-36 px-4"
        style={{
          backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.75) 100%), url('/hero-extincteur.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#0f172a',
        }}
      >
        <div className="max-w-5xl mx-auto relative z-10 flex flex-col items-end text-right">
          <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: ORANGE }}>
            La plateforme pour vos vérifications d'extincteurs portatifs
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 leading-tight px-2 max-w-2xl">
            Inspection. Certification. Conformité.<br />
            <span style={{ color: ORANGE }}>Tout en un.</span>
          </h1>
          <p className="text-white/80 text-base md:text-lg max-w-xl mb-10 leading-relaxed px-2">
            Superviseurs, techniciens et citoyens sur une seule plateforme — remplissez vos rapports de
            vérification, générez vos certificats et gardez chaque bâtiment conforme.
          </p>
          <div className="flex justify-end px-4 w-full">
            <Link href="/login"
              className="w-full sm:w-auto bg-[#dc2626] text-white px-8 py-3.5 rounded-full text-sm font-bold hover:bg-[#b91c1c] transition-colors duration-200 text-center shadow-lg">
              Se connecter
            </Link>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap justify-end gap-10 mt-14 border-t border-white/10 pt-10 w-full">
            {[
              { value: '100%', label: 'Web, aucune installation' },
              { value: '3 rôles', label: 'Superviseur · Technicien · Citoyen' },
              { value: 'PDF', label: 'Rapports et certificats imprimables' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-black text-white">{s.value}</p>
                <p className="text-xs text-white/60 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* coupe diagonale blanche en bas */}
        <div
          className="absolute bottom-0 left-0 right-0 h-16 bg-white"
          style={{ clipPath: 'polygon(0 100%, 100% 40%, 100% 100%)' }}
        />
      </section>

      {/* Features */}
      <section className="py-20 px-4 border-b border-gray-100" id="fonctionnalites">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-center mb-3" style={{ color: ORANGE }}>Fonctionnalités</p>
          <h2 className="text-3xl font-black text-center mb-4" style={{ color: NAVY }}>Tout ce dont vous avez besoin</h2>
          <p className="text-center text-gray-400 text-sm mb-16 max-w-xl mx-auto">
            Une plateforme complète pour gérer vos vérifications d'extincteurs, vos rôles d'équipe et vos certificats de conformité.
          </p>

          {/* Feature 1 — Tableau de vérification */}
          <div className="flex flex-col md:flex-row items-center gap-12 mb-24">
            <div className="md:w-1/2">
              <div className="w-12 h-12 rounded-md flex items-center justify-center mb-5" style={{ background: NAVY }}>
                <i className="ti ti-clipboard-check text-white text-xl"></i>
              </div>
              <h3 className="text-2xl font-bold mb-3" style={{ color: NAVY }}>Tableau de vérification dynamique</h3>
              <p className="text-gray-500 leading-relaxed text-sm mb-5">
                Remplissez le tableau des extincteurs directement sur le terrain : étage, emplacement, type,
                format, marque, état — une ligne par extincteur, avec dates de maintenance et de test hydrostatique.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Inventaire par extincteur', 'États D / I / NI', 'Filtres par client', 'Sauvegarde automatique'].map(t => (
                  <span key={t} className="text-xs px-3 py-1.5 rounded-md font-semibold" style={{ background: '#fff2e8', color: ORANGE }}>{t}</span>
                ))}
              </div>
            </div>
            <div className="md:w-1/2">
              <img src="/fiche.png" alt="Tableau de vérification dynamique"
                className="rounded-md border border-gray-100 w-full" />
            </div>
          </div>

          {/* Feature 2 — Rôles */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-12 mb-24">
            <div className="md:w-1/2">
              <div className="w-12 h-12 rounded-md flex items-center justify-center mb-5" style={{ background: NAVY }}>
                <i className="ti ti-users text-white text-xl"></i>
              </div>
              <h3 className="text-2xl font-bold mb-3" style={{ color: NAVY }}>Gestion des rôles</h3>
              <p className="text-gray-500 leading-relaxed text-sm mb-5">
                Le superviseur crée et distribue les rapports, le technicien les remplit sur place,
                et le citoyen consulte son rapport et son certificat — chacun voit exactement ce dont il a besoin.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Superviseur', 'Technicien', 'Citoyen', 'Invitations par courriel'].map(t => (
                  <span key={t} className="text-xs px-3 py-1.5 rounded-md font-semibold" style={{ background: '#fff2e8', color: ORANGE }}>{t}</span>
                ))}
              </div>
            </div>
            <div className="md:w-1/2 flex flex-col gap-4">
              <img src="/dasbord.png" alt="Vue superviseur"
                className="rounded-md border border-gray-100 w-full" />
              <img src="/technicien.png" alt="Vue technicien"
                className="rounded-md border border-gray-100 w-full" />
            </div>
          </div>

          {/* Feature 3 — Certificats PDF */}
          <div className="flex flex-col md:flex-row items-center gap-12 mb-24">
            <div className="md:w-1/2">
              <div className="w-12 h-12 rounded-md flex items-center justify-center mb-5" style={{ background: NAVY }}>
                <i className="ti ti-certificate text-white text-xl"></i>
              </div>
              <h3 className="text-2xl font-bold mb-3" style={{ color: NAVY }}>Certificats & rapports PDF</h3>
              <p className="text-gray-500 leading-relaxed text-sm mb-5">
                Une fois la fiche fermée, le certificat de conformité est généré et envoyé automatiquement
                au citoyen. Téléchargez chaque rapport en PDF en un clic.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Génération auto', 'Envoi au citoyen', 'Export PDF', 'Historique conservé'].map(t => (
                  <span key={t} className="text-xs px-3 py-1.5 rounded-md font-semibold" style={{ background: '#fff2e8', color: ORANGE }}>{t}</span>
                ))}
              </div>
            </div>
            <div className="md:w-1/2">
              <img src="/certificat.png" alt="Certificats et rapports PDF"
                className="rounded-md border border-gray-100 w-full" />
            </div>
          </div>

          {/* Feature 4 — Historique */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-12">
            <div className="md:w-1/2">
              <div className="w-12 h-12 rounded-md flex items-center justify-center mb-5" style={{ background: NAVY }}>
                <i className="ti ti-history text-white text-xl"></i>
              </div>
              <h3 className="text-2xl font-bold mb-3" style={{ color: NAVY }}>Historique & traçabilité</h3>
              <p className="text-gray-500 leading-relaxed text-sm mb-5">
                Chaque fiche garde la date de sauvegarde, la date de prise d'effet et le nom du technicien
                qui l'a remplie. Rien ne se perd, tout reste consultable en mode lecture.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Chronologie', 'Dates de sauvegarde', 'Mode lecture seule', 'Traçabilité complète'].map(t => (
                  <span key={t} className="text-xs px-3 py-1.5 rounded-md font-semibold" style={{ background: '#fff2e8', color: ORANGE }}>{t}</span>
                ))}
              </div>
            </div>
            <div className="md:w-1/2">
              <img src="/tracabilit.png" alt="Historique et traçabilité"
                className="rounded-md border border-gray-100 w-full" />
            </div>
          </div>

        </div>
      </section>

      {/* À propos — remplace la section plans/tarifs, ce n'est pas un SaaS */}
      <section className="py-20 px-4 bg-gray-50 border-b border-gray-100" id="a-propos">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-center mb-3" style={{ color: ORANGE }}>À propos</p>
          <h2 className="text-3xl font-black text-center mb-4" style={{ color: NAVY }}>Extincteurs Nationex</h2>
          <p className="text-center text-gray-500 text-sm mb-14 max-w-2xl mx-auto leading-relaxed">
            Une plateforme interne conçue pour simplifier la vérification annuelle des extincteurs
            portatifs, du terrain jusqu'au certificat remis au citoyen.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-md border border-gray-200 p-6">
              <div className="w-10 h-10 rounded-md flex items-center justify-center mb-4" style={{ background: NAVY }}>
                <i className="ti ti-shield-check text-white text-lg"></i>
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: NAVY }}>Conformité assurée</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Chaque rapport suit une structure claire, de l'inventaire des extincteurs jusqu'au
                certificat de vérification.
              </p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 p-6">
              <div className="w-10 h-10 rounded-md flex items-center justify-center mb-4" style={{ background: NAVY }}>
                <i className="ti ti-users-group text-white text-lg"></i>
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: NAVY }}>Une équipe, trois rôles</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Superviseurs, techniciens et citoyens travaillent sur la même plateforme, chacun avec
                l'accès qui lui revient.
              </p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 p-6">
              <div className="w-10 h-10 rounded-md flex items-center justify-center mb-4" style={{ background: NAVY }}>
                <i className="ti ti-file-certificate text-white text-lg"></i>
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: NAVY }}>Traçabilité complète</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Chaque fiche fermée, chaque certificat émis et chaque date de passage restent consultables
                en tout temps.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-20 px-4 border-t border-gray-100" id="contact">
        <div className="max-w-5xl mx-auto">

          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ORANGE }}>Contactez-nous</p>
            <h2 className="text-3xl font-black mb-4" style={{ color: NAVY }}>
              Une question sur vos inspections ?
            </h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              Notre équipe est disponible pour répondre à toutes vos questions sur la plateforme.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
            {[
              { icon: 'ti-phone',   label: 'Téléphone',     value: '514-000-0000',                     href: 'tel:+15140000000' },
              { icon: 'ti-mail',    label: 'Email',          value: 'info@extincteursnationex.com',     href: 'mailto:info@extincteursnationex.com' },
              // { icon: 'ti-map-pin', label: 'Adresse',        value: '10600 boul. Parkway, Anjou, QC',   href: null },
              { icon: 'ti-clock',   label: 'Disponibilité',  value: 'Lun–Ven  8h–16h',                  href: null },
            ].map((item) => (
              <div key={item.label} className="rounded-md p-4 flex flex-col items-center text-center gap-2 border border-gray-200" style={{ background: '#fff2e8' }}>
                <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: NAVY }}>
                  <i className={`ti ${item.icon} text-white text-base`} />
                </div>
                <p className="text-xs text-gray-400 font-medium">{item.label}</p>
                {item.href ? (
                  <a href={item.href} className="text-sm font-bold hover:opacity-70 transition-opacity leading-tight" style={{ color: NAVY }}>{item.value}</a>
                ) : (
                  <p className="text-sm font-bold leading-tight" style={{ color: NAVY }}>{item.value}</p>
                )}
              </div>
            ))}
          </div>

          <ContactForm />

          {/* CTA — flat, plus de gradient/cercles décoratifs */}
          <div className="rounded-md p-10 text-center text-white mt-12" style={{ background: NAVY }}>
            <h3 className="text-2xl font-black mb-3">Gérez vos inspections. Restez conformes.</h3>
            <p className="text-white/70 text-sm mb-8 max-w-lg mx-auto">
              La plateforme interne de Extincteurs Nationex pour gérer vos inspections annuelles.
            </p>
            <div className="flex justify-center px-4">
              <Link href="/login"
                className="w-full sm:w-auto bg-[#dc2626] text-white px-8 py-3.5 rounded-md text-sm font-bold hover:bg-[#e35c0f] transition-colors duration-200">
                Se connecter
              </Link>
            </div>
          </div>

        </div>
      </section>

      <PublicFooter />
    </div>
  )
}