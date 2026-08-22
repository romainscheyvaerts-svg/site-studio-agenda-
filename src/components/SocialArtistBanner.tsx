import { Users, ArrowRight, MessageCircle, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/hooks/useViewMode";
import { SOCIAL_ARTIST_URL } from "@/config/constants";

/**
 * Bannière d'accueil invitant à rejoindre le réseau social dédié aux artistes
 * (plateforme Music Artist / Social Artist).
 */
const SocialArtistBanner = () => {
  const { isMobileView } = useViewMode();

  const features = [
    { icon: UserCircle, label: "Crée ta page artiste" },
    { icon: MessageCircle, label: "Échange avec d'autres artistes" },
    { icon: Users, label: "Un réseau réservé aux artistes" },
  ];

  return (
    <section className={cn("container mx-auto", isMobileView ? "px-5 py-8" : "px-6 py-16")}>
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-secondary/20 to-background p-8 md:p-12">
        {/* halo décoratif */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/20 px-4 py-1.5 text-xs font-medium text-primary">
              <Users className="h-3.5 w-3.5" />
              Le réseau social des artistes
            </div>
            <h2 className="mb-3 font-display text-2xl text-foreground md:text-3xl">
              Rejoins la communauté <span className="text-primary">Music Artist</span>
            </h2>
            <p className="mb-5 text-sm text-muted-foreground md:text-base">
              Un réseau social pensé spécialement pour les artistes : crée ta page,
              présente ta musique et échange avec d'autres artistes.
            </p>

            <ul className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:flex-wrap md:gap-4">
              {features.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center justify-center gap-2 md:justify-start">
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <a
            href={SOCIAL_ARTIST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-7 py-4 font-medium text-primary-foreground transition-all duration-300 hover:scale-105 hover:bg-primary/90"
          >
            Découvrir le réseau
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default SocialArtistBanner;
