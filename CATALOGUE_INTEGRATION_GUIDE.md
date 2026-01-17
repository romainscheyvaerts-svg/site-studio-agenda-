# Guide d'intégration du Catalogue d'Instrumentaux

Ce guide explique comment intégrer le catalogue d'instrumentaux Make Music sur un autre site.

## Prérequis

1. **Projet Supabase** : Le projet Make Music Booking utilise Supabase
   - URL: `https://mxdrxpzxbgybchzzvpkf.supabase.co`
   - Vous devez avoir les clés API (anon key) pour ce projet

2. **Variables d'environnement** à configurer dans votre `.env` :
```env
VITE_SUPABASE_URL=https://mxdrxpzxbgybchzzvpkf.supabase.co
VITE_SUPABASE_ANON_KEY=votre_anon_key_ici
```

---

## Structure de la base de données

### Table `instrumentals`
```sql
CREATE TABLE public.instrumentals (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  genre TEXT,
  bpm INTEGER,
  key TEXT,
  preview_url TEXT,           -- URL directe pour preview (optionnel)
  cover_image_url TEXT,       -- URL de l'image de couverture
  drive_file_id TEXT NOT NULL, -- ID du fichier Google Drive (audio HQ)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Table `instrumental_licenses`
```sql
CREATE TABLE public.instrumental_licenses (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,          -- "Basic", "Premium", "Exclusive"
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  features TEXT[],             -- Liste des avantages
  sort_order INTEGER,
  is_active BOOLEAN DEFAULT true
);
```

---

## Configuration du client Supabase

### Installation
```bash
npm install @supabase/supabase-js
```

### Initialisation (`src/integrations/supabase/client.ts`)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## Interface TypeScript

```typescript
interface Instrumental {
  id: string;
  title: string;
  description?: string;
  genre?: string;
  bpm?: number;
  key?: string;
  preview_url?: string;
  cover_image_url?: string;
  drive_file_id?: string;
  price_base?: number;
  price_stems?: number;
  price_exclusive?: number;
  has_stems?: boolean;
  stems_folder_id?: string;
}
```

---

## Récupération des instrumentaux

### Code pour charger le catalogue
```typescript
import { supabase } from '@/integrations/supabase/client';

const fetchInstrumentals = async () => {
  const { data, error } = await supabase
    .from("instrumentals")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur:", error);
    return [];
  }

  return data;
};
```

### Hook React complet
```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useInstrumentals = () => {
  const [instrumentals, setInstrumentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("instrumentals")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        setError(error);
      } else {
        setInstrumentals(data || []);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  return { instrumentals, loading, error };
};
```

---

## Streaming Audio (Preview)

Les fichiers audio sont stockés sur Google Drive. Pour les streamer, utilisez l'Edge Function `stream-instrumental`.

### URL de streaming
```typescript
const getAudioUrl = (fileId: string): string => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/stream-instrumental?fileId=${fileId}`;
};

// Usage
const audioSrc = instrumental.preview_url || getAudioUrl(instrumental.drive_file_id);
```

### Composant Audio simple
```typescript
const AudioPreview = ({ instrumental }) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const audioUrl = instrumental.preview_url
    || `${supabaseUrl}/functions/v1/stream-instrumental?fileId=${instrumental.drive_file_id}`;

  return (
    <audio controls>
      <source src={audioUrl} type="audio/mpeg" />
    </audio>
  );
};
```

---

## Affichage des images de couverture

Les images de couverture sont stockées dans Supabase Storage (bucket `instrumental-covers`).

```typescript
// L'URL est directement dans cover_image_url
<img
  src={instrumental.cover_image_url}
  alt={instrumental.title}
  className="w-full h-full object-cover"
/>
```

---

## Exemple de composant Card

```typescript
import { Play, Pause } from 'lucide-react';

const InstrumentalCard = ({ instrumental, onPlay, isPlaying }) => {
  return (
    <div className="bg-card rounded-xl overflow-hidden border">
      {/* Cover Image */}
      <div className="aspect-square relative">
        {instrumental.cover_image_url ? (
          <img
            src={instrumental.cover_image_url}
            alt={instrumental.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span>No Cover</span>
          </div>
        )}

        {/* Play Button Overlay */}
        <button
          onClick={() => onPlay(instrumental)}
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
        >
          {isPlaying ? <Pause size={48} /> : <Play size={48} />}
        </button>

        {/* Genre Badge */}
        {instrumental.genre && (
          <span className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
            {instrumental.genre}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-bold text-lg truncate">{instrumental.title}</h3>
        <div className="text-sm text-muted-foreground flex gap-2">
          {instrumental.bpm && <span>{instrumental.bpm} BPM</span>}
          {instrumental.key && <span>{instrumental.key}</span>}
        </div>
      </div>
    </div>
  );
};
```

---

## Page Catalogue complète

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CataloguePage = () => {
  const [instrumentals, setInstrumentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPlaying, setCurrentPlaying] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("instrumentals")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      setInstrumentals(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  // Filtrage
  const filtered = instrumentals.filter(i => {
    const matchSearch = !searchQuery ||
      i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.genre?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchGenre = !selectedGenre || i.genre === selectedGenre;
    return matchSearch && matchGenre;
  });

  // Genres uniques
  const genres = [...new Set(instrumentals.map(i => i.genre).filter(Boolean))];

  const handlePlay = (instrumental) => {
    setCurrentPlaying(currentPlaying?.id === instrumental.id ? null : instrumental);
  };

  const getAudioUrl = (inst) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return inst.preview_url || `${supabaseUrl}/functions/v1/stream-instrumental?fileId=${inst.drive_file_id}`;
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <div>
      {/* Search */}
      <input
        type="text"
        placeholder="Rechercher..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Genre Filters */}
      <div className="flex gap-2 my-4">
        <button onClick={() => setSelectedGenre(null)}>Tous</button>
        {genres.map(genre => (
          <button
            key={genre}
            onClick={() => setSelectedGenre(genre)}
            className={selectedGenre === genre ? 'active' : ''}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* Player */}
      {currentPlaying && (
        <audio
          src={getAudioUrl(currentPlaying)}
          autoPlay
          controls
          onEnded={() => setCurrentPlaying(null)}
        />
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map(inst => (
          <InstrumentalCard
            key={inst.id}
            instrumental={inst}
            onPlay={handlePlay}
            isPlaying={currentPlaying?.id === inst.id}
          />
        ))}
      </div>
    </div>
  );
};
```

---

## Politiques RLS (Row Level Security)

Les instrumentaux sont publics en lecture (pour les actifs) :

```sql
-- N'importe qui peut voir les instrumentaux actifs
CREATE POLICY "Anyone can view active instrumentals"
ON public.instrumentals FOR SELECT
USING (is_active = true);
```

**Important** : Vous n'avez PAS besoin d'être authentifié pour lire les instrumentaux actifs.

---

## Récapitulatif des Edge Functions utilisables

| Function | Description | Auth requise |
|----------|-------------|--------------|
| `stream-instrumental` | Stream audio depuis Google Drive | Non |

### Appel de stream-instrumental
```
GET https://mxdrxpzxbgybchzzvpkf.supabase.co/functions/v1/stream-instrumental?fileId={drive_file_id}
```

---

## Checklist d'intégration

- [ ] Installer `@supabase/supabase-js`
- [ ] Configurer les variables d'environnement (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [ ] Créer le client Supabase
- [ ] Créer le hook/fonction pour récupérer les instrumentaux
- [ ] Créer le composant Card pour afficher un instrumental
- [ ] Implémenter le player audio avec l'URL de streaming
- [ ] Ajouter la recherche et les filtres par genre

---

## Dépannage

### Les instrumentaux ne se chargent pas
1. Vérifiez que `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont corrects
2. Vérifiez la console pour les erreurs CORS
3. Assurez-vous que la table `instrumentals` contient des données avec `is_active = true`

### L'audio ne joue pas
1. Vérifiez que `drive_file_id` existe sur l'instrumental
2. Testez l'URL directement : `{SUPABASE_URL}/functions/v1/stream-instrumental?fileId={ID}`
3. Vérifiez les logs de l'Edge Function dans Supabase Dashboard

### Les images ne s'affichent pas
1. Vérifiez que `cover_image_url` n'est pas null
2. L'URL doit être une URL complète vers le bucket Supabase Storage
