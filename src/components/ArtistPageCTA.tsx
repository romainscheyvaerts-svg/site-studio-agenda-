import { UserCircle, FileText, Users, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOCIAL_ARTIST_URL } from "@/config/constants";

/**
 * Encart affiché après un achat d'instru ou une réservation studio :
 * invite l'artiste à créer gratuitement sa page artiste et son dossier de presse
 * sur le réseau social Music Artist.
 */
const ArtistPageCTA = ({ className }: { className?: string }) => {
  const perks = [
    { icon: UserCircle, label: "Ta page artiste" },
    { icon: FileText, label: "Ton dossier de presse" },
    { icon: Users, label: "Le réseau des artistes" },
  ];

  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-secondary/20 to-background p-6 text-left",
        className
      )}
    >
      <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary">
        <Users className="h-3.5 w-3.5" />
        100% gratuit
      </div>
      <h3 className="mb-1.5 font-display text-lg text-foreground">
        Crée gratuitement ta page artiste
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Sur <span className="font-medium text-foreground">Music Artist</span>, le réseau social
        des artistes : présente ta musique, monte ton dossier de presse et échange
        avec d'autres artistes.
      </p>

      <ul className="mb-5 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-4">
        {perks.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            {label}
          </li>
        ))}
      </ul>

      <a
        href={SOCIAL_ARTIST_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all duration-300 hover:scale-105 hover:bg-primary/90"
      >
        Créer ma page gratuitement
        <ArrowRight className="h-4 w-4" />
      </a>
    </div>
  );
};

export default ArtistPageCTA;
