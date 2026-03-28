import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Clock,
  Calendar,
  User,
  Users,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Gift,
  Link2,
  Unlink,
  AlertTriangle,
  Check,
  X,
  Merge,
  Eye,
  EyeOff,
  Edit3,
  Trash2
} from "lucide-react";

// =========================================================================
// Fuzzy matching utilities
// =========================================================================

/**
 * Levenshtein distance between two strings (case-insensitive, accent-insensitive)
 */
function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= an; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bn; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[an][bn];
}

/**
 * Normalize a name for comparison: lowercase, remove accents, remove extra spaces
 */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Compute similarity ratio between two names (0 = totally different, 1 = identical)
 * Uses a combination of:
 * - Levenshtein ratio on the full string
 * - Token-level matching (handles name parts in different order)
 */
function nameSimilarity(nameA: string, nameB: string): number {
  const a = normalizeName(nameA);
  const b = normalizeName(nameB);

  if (a === b) return 1;
  if (!a || !b) return 0;

  // Full string Levenshtein ratio
  const maxLen = Math.max(a.length, b.length);
  const dist = levenshtein(a, b);
  const fullRatio = 1 - dist / maxLen;

  // Token-level matching (handle "Prénom Nom" vs "Nom Prénom" or partial matches)
  const tokensA = a.split(" ").filter(t => t.length > 1);
  const tokensB = b.split(" ").filter(t => t.length > 1);

  if (tokensA.length === 0 || tokensB.length === 0) return fullRatio;

  let matchedTokens = 0;
  const usedB = new Set<number>();

  for (const tA of tokensA) {
    let bestMatch = 0;
    let bestIdx = -1;

    for (let j = 0; j < tokensB.length; j++) {
      if (usedB.has(j)) continue;
      const tB = tokensB[j];
      const tokenMaxLen = Math.max(tA.length, tB.length);
      const tokenDist = levenshtein(tA, tB);
      const tokenRatio = 1 - tokenDist / tokenMaxLen;

      if (tokenRatio > bestMatch) {
        bestMatch = tokenRatio;
        bestIdx = j;
      }
    }

    if (bestMatch >= 0.7 && bestIdx >= 0) {
      matchedTokens += bestMatch;
      usedB.add(bestIdx);
    }
  }

  const tokenRatio = matchedTokens / Math.max(tokensA.length, tokensB.length);

  // Return the best of both strategies
  return Math.max(fullRatio, tokenRatio);
}

/**
 * Check if two names likely refer to the same person
 * Threshold tuned for common typos: garri/gari, mohamed/mohamad, etc.
 */
function areNamesSimilar(nameA: string, nameB: string, threshold = 0.75): boolean {
  return nameSimilarity(nameA, nameB) >= threshold;
}

// =========================================================================
// Merge storage (localStorage persistence)
// =========================================================================

const MERGE_STORAGE_KEY = "admin_client_merges";

interface MergeMapping {
  // Key: the "secondary" client email that gets merged INTO the primary
  // Value: the "primary" client email
  [secondaryEmail: string]: string;
}

function loadMerges(): MergeMapping {
  try {
    const stored = localStorage.getItem(MERGE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveMerges(merges: MergeMapping) {
  localStorage.setItem(MERGE_STORAGE_KEY, JSON.stringify(merges));
}

// =========================================================================
// Interfaces
// =========================================================================

interface CalendarSession {
  id: string;
  title: string;
  date: string;
  startHour: number;
  endHour: number;
  duration: number;
  isFree: boolean;
  originalClientEmail?: string; // Track the original email before merge
}

interface ClientFromCalendar {
  email: string;
  name: string | null;
  allNames: string[]; // All name variants seen for this client
  allEmails: string[]; // All emails merged into this client
  totalSessions: number;
  totalHours: number;
  totalPaidHours: number;
  totalFreeHours: number;
  firstSession: string | null;
  lastSession: string | null;
  sessions: CalendarSession[];
  isMerged: boolean; // Whether this client has merged entries
}

interface MonthlyStats {
  month: string;
  label: string;
  totalHours: number;
  paidHours: number;
  freeHours: number;
  sessions: number;
}

interface YearlyStats {
  year: string;
  totalHours: number;
  paidHours: number;
  freeHours: number;
  sessions: number;
}

interface SuggestedMerge {
  emailA: string;
  nameA: string;
  emailB: string;
  nameB: string;
  similarity: number;
}

// =========================================================================
// Component
// =========================================================================

const AdminClientAccounting = () => {
  const { t } = useTranslation();
  const { isSuperAdmin, user } = useAdmin();
  const [rawClients, setRawClients] = useState<ClientFromCalendar[]>([]);
  const [allSessions, setAllSessions] = useState<CalendarSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  // Merge state
  const [merges, setMerges] = useState<MergeMapping>(loadMerges());
  const [suggestedMerges, setSuggestedMerges] = useState<SuggestedMerge[]>([]);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showMergeManager, setShowMergeManager] = useState(false);
  const [manualMergeSource, setManualMergeSource] = useState<string | null>(null);
  const [manualMergeTarget, setManualMergeTarget] = useState<string>("");
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("admin_dismissed_merge_suggestions");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Current user email for filtering (admins can only see their own data)
  const currentUserEmail = user?.email?.toLowerCase();

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("clients");

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setProgress("Chargement des données...");

    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);

      setProgress("Récupération des événements du calendrier (6 derniers mois)...");

      const allSlots: Array<{
        date: string;
        clientEmail?: string;
        eventName?: string;
        hour: number;
        isFree?: boolean;
      }> = [];
      let currentStart = new Date(startDate);
      const today = new Date();

      while (currentStart < today) {
        const chunkStartStr = currentStart.toISOString().split("T")[0];
        const daysToFetch = Math.min(90, Math.ceil((today.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)));

        setProgress(`Chargement: ${chunkStartStr}...`);

        const { data, error: fetchError } = await supabase.functions.invoke("get-weekly-availability", {
          body: {
            startDate: chunkStartStr,
            days: daysToFetch,
            includeSuperadminCalendars: false
          }
        });

        if (fetchError) {
          console.error("Error fetching availability:", fetchError);
          if (allSlots.length === 0) {
            throw new Error(`Impossible de charger les données: ${fetchError.message || "Erreur de connexion à la fonction Edge"}`);
          }
          currentStart.setDate(currentStart.getDate() + daysToFetch);
          continue;
        }

        if (data?.availability) {
          for (const day of data.availability) {
            for (const slot of day.slots) {
              if (slot.status === "unavailable" && slot.eventName) {
                const isFree = slot.eventName?.toLowerCase().includes("[free]") || false;
                allSlots.push({
                  date: day.date,
                  clientEmail: slot.clientEmail,
                  eventName: slot.eventName,
                  hour: slot.hour,
                  isFree
                });
              }
            }
          }
        }

        currentStart.setDate(currentStart.getDate() + daysToFetch);
      }

      setProgress("Analyse des données clients...");

      // Build raw client map (before merges)
      const clientsMap = new Map<string, ClientFromCalendar>();
      const sessionMap = new Map<string, CalendarSession>();
      const sessionsForStats: CalendarSession[] = [];

      for (const slot of allSlots) {
        const sessionKey = slot.clientEmail
          ? `${slot.clientEmail.toLowerCase()}-${slot.date}`
          : `unknown-${slot.date}-${slot.eventName}`;

        let session = sessionMap.get(sessionKey);
        if (!session) {
          session = {
            id: sessionKey,
            title: slot.eventName || "Session",
            date: slot.date,
            startHour: slot.hour,
            endHour: slot.hour + 1,
            duration: 1,
            isFree: slot.isFree || false,
            originalClientEmail: slot.clientEmail?.toLowerCase()
          };
          sessionMap.set(sessionKey, session);
        } else {
          if (slot.hour < session.startHour) session.startHour = slot.hour;
          if (slot.hour + 1 > session.endHour) session.endHour = slot.hour + 1;
          session.duration = session.endHour - session.startHour;
          if (slot.eventName && !session.title.includes(slot.eventName)) session.title = slot.eventName;
          if (slot.isFree) session.isFree = true;
        }

        if (slot.clientEmail) {
          const email = slot.clientEmail.toLowerCase();

          let client = clientsMap.get(email);
          if (!client) {
            client = {
              email,
              name: null,
              allNames: [],
              allEmails: [email],
              totalSessions: 0,
              totalHours: 0,
              totalPaidHours: 0,
              totalFreeHours: 0,
              firstSession: null,
              lastSession: null,
              sessions: [],
              isMerged: false
            };
            clientsMap.set(email, client);
          }

          // Extract name from event title
          if (slot.eventName) {
            const cleanName = slot.eventName
              .replace(/\[FREE\]/gi, "")
              .replace(/session|réservation|booking|rec|recording|enregistrement|avec ingénieur|sans ingénieur|location|mixage|mastering|podcast|composition/gi, "")
              .replace(/[-:]/g, " ")
              .trim();
            if (cleanName && !cleanName.includes("@") && cleanName.length > 2) {
              // Store all name variants
              const normalizedClean = normalizeName(cleanName);
              if (!client.allNames.some(n => normalizeName(n) === normalizedClean)) {
                client.allNames.push(cleanName);
              }
              if (!client.name || cleanName.length > client.name.length) {
                client.name = cleanName;
              }
            }
          }

          if (!client.firstSession || slot.date < client.firstSession) client.firstSession = slot.date;
          if (!client.lastSession || slot.date > client.lastSession) client.lastSession = slot.date;
        }
      }

      // Assign sessions to clients
      for (const [sessionKey, session] of sessionMap) {
        sessionsForStats.push(session);

        const emailPart = sessionKey.split("-")[0];
        if (emailPart !== "unknown") {
          const client = clientsMap.get(emailPart);
          if (client && !client.sessions.find(s => s.id === session.id)) {
            client.sessions.push(session);
            client.totalHours += session.duration;
            if (session.isFree) {
              client.totalFreeHours += session.duration;
            } else {
              client.totalPaidHours += session.duration;
            }
          }
        }
      }

      for (const client of clientsMap.values()) {
        const uniqueDates = new Set(client.sessions.map(s => s.date));
        client.totalSessions = uniqueDates.size;
        client.sessions.sort((a, b) => b.date.localeCompare(a.date));
      }

      const clientsList = Array.from(clientsMap.values())
        .filter(c => c.totalSessions > 0)
        .sort((a, b) => (b.lastSession || "").localeCompare(a.lastSession || ""));

      setRawClients(clientsList);
      setAllSessions(sessionsForStats);

      // Auto-detect merge suggestions
      detectMergeSuggestions(clientsList);

      setProgress("");
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Fuzzy merge detection
  // -----------------------------------------------------------------------

  const detectMergeSuggestions = useCallback((clientsList: ClientFromCalendar[]) => {
    const suggestions: SuggestedMerge[] = [];
    const checked = new Set<string>();

    for (let i = 0; i < clientsList.length; i++) {
      for (let j = i + 1; j < clientsList.length; j++) {
        const cA = clientsList[i];
        const cB = clientsList[j];

        // Skip if already merged
        if (merges[cA.email] || merges[cB.email]) continue;

        // Skip if same email
        if (cA.email === cB.email) continue;

        const pairKey = [cA.email, cB.email].sort().join("|");
        if (checked.has(pairKey)) continue;
        checked.add(pairKey);

        // Compare all name variants between both clients
        let bestSimilarity = 0;
        let bestNameA = cA.name || cA.email;
        let bestNameB = cB.name || cB.email;

        const namesA = cA.allNames.length > 0 ? cA.allNames : [cA.name || cA.email];
        const namesB = cB.allNames.length > 0 ? cB.allNames : [cB.name || cB.email];

        for (const nA of namesA) {
          for (const nB of namesB) {
            const sim = nameSimilarity(nA, nB);
            if (sim > bestSimilarity) {
              bestSimilarity = sim;
              bestNameA = nA;
              bestNameB = nB;
            }
          }
        }

        // Also compare emails before @ (useful when names are emails)
        const emailPartA = cA.email.split("@")[0];
        const emailPartB = cB.email.split("@")[0];
        const emailSim = nameSimilarity(emailPartA, emailPartB);
        if (emailSim > bestSimilarity) {
          bestSimilarity = emailSim;
          bestNameA = cA.name || cA.email;
          bestNameB = cB.name || cB.email;
        }

        if (bestSimilarity >= 0.70) {
          suggestions.push({
            emailA: cA.email,
            nameA: bestNameA,
            emailB: cB.email,
            nameB: bestNameB,
            similarity: bestSimilarity
          });
        }
      }
    }

    // Sort by similarity (highest first)
    suggestions.sort((a, b) => b.similarity - a.similarity);
    setSuggestedMerges(suggestions);
  }, [merges]);

  // -----------------------------------------------------------------------
  // Merge management
  // -----------------------------------------------------------------------

  const applyMerge = (secondaryEmail: string, primaryEmail: string) => {
    const newMerges = { ...merges, [secondaryEmail]: primaryEmail };
    setMerges(newMerges);
    saveMerges(newMerges);
    // Remove suggestion from list
    setSuggestedMerges(prev => prev.filter(s =>
      !(s.emailA === secondaryEmail && s.emailB === primaryEmail) &&
      !(s.emailB === secondaryEmail && s.emailA === primaryEmail)
    ));
  };

  const removeMerge = (secondaryEmail: string) => {
    const newMerges = { ...merges };
    delete newMerges[secondaryEmail];
    setMerges(newMerges);
    saveMerges(newMerges);
  };

  const dismissSuggestion = (emailA: string, emailB: string) => {
    const key = [emailA, emailB].sort().join("|");
    const newDismissed = new Set(dismissedSuggestions);
    newDismissed.add(key);
    setDismissedSuggestions(newDismissed);
    localStorage.setItem("admin_dismissed_merge_suggestions", JSON.stringify([...newDismissed]));
    setSuggestedMerges(prev => prev.filter(s => {
      const sKey = [s.emailA, s.emailB].sort().join("|");
      return sKey !== key;
    }));
  };

  // -----------------------------------------------------------------------
  // Apply merges to build final client list
  // -----------------------------------------------------------------------

  const clients = useMemo(() => {
    if (Object.keys(merges).length === 0) return rawClients;

    const mergedMap = new Map<string, ClientFromCalendar>();

    // First pass: identify primary clients
    for (const client of rawClients) {
      const primaryEmail = merges[client.email] || client.email;

      let primary = mergedMap.get(primaryEmail);
      if (!primary) {
        // Find the original primary client data
        const originalPrimary = rawClients.find(c => c.email === primaryEmail);
        primary = {
          email: primaryEmail,
          name: originalPrimary?.name || client.name,
          allNames: [...(originalPrimary?.allNames || [])],
          allEmails: [primaryEmail],
          totalSessions: 0,
          totalHours: 0,
          totalPaidHours: 0,
          totalFreeHours: 0,
          firstSession: null,
          lastSession: null,
          sessions: [],
          isMerged: false
        };
        mergedMap.set(primaryEmail, primary);
      }

      // If this is a secondary being merged into primary
      if (client.email !== primaryEmail) {
        primary.isMerged = true;
        if (!primary.allEmails.includes(client.email)) {
          primary.allEmails.push(client.email);
        }
        // Add name variants
        for (const n of client.allNames) {
          if (!primary.allNames.some(pn => normalizeName(pn) === normalizeName(n))) {
            primary.allNames.push(n);
          }
        }
        // Pick the longest/best name
        if (client.name && (!primary.name || client.name.length > primary.name.length)) {
          primary.name = client.name;
        }
      }

      // Merge sessions
      for (const session of client.sessions) {
        const sessionWithOrigin = { ...session, originalClientEmail: client.email };
        if (!primary.sessions.find(s => s.id === session.id)) {
          primary.sessions.push(sessionWithOrigin);
          primary.totalHours += session.duration;
          if (session.isFree) {
            primary.totalFreeHours += session.duration;
          } else {
            primary.totalPaidHours += session.duration;
          }
        }
      }

      // Update date range
      if (client.firstSession && (!primary.firstSession || client.firstSession < primary.firstSession)) {
        primary.firstSession = client.firstSession;
      }
      if (client.lastSession && (!primary.lastSession || client.lastSession > primary.lastSession)) {
        primary.lastSession = client.lastSession;
      }
    }

    // Finalize
    for (const client of mergedMap.values()) {
      const uniqueDates = new Set(client.sessions.map(s => s.date));
      client.totalSessions = uniqueDates.size;
      client.sessions.sort((a, b) => b.date.localeCompare(a.date));
    }

    return Array.from(mergedMap.values())
      .filter(c => c.totalSessions > 0)
      .sort((a, b) => (b.lastSession || "").localeCompare(a.lastSession || ""));
  }, [rawClients, merges]);

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  const { monthlyStats, yearlyStats, availableYears, availableMonths } = useMemo(() => {
    const monthlyMap = new Map<string, MonthlyStats>();
    const yearlyMap = new Map<string, YearlyStats>();
    const yearsSet = new Set<string>();
    const monthsSet = new Set<string>();

    for (const session of allSessions) {
      const year = session.date.substring(0, 4);
      const month = session.date.substring(0, 7);

      yearsSet.add(year);
      monthsSet.add(month);

      if (!monthlyMap.has(month)) {
        const monthDate = new Date(month + "-01");
        const monthLabel = monthDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
        monthlyMap.set(month, {
          month,
          label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          totalHours: 0,
          paidHours: 0,
          freeHours: 0,
          sessions: 0
        });
      }
      const monthStats = monthlyMap.get(month)!;
      monthStats.totalHours += session.duration;
      monthStats.sessions++;
      if (session.isFree) monthStats.freeHours += session.duration;
      else monthStats.paidHours += session.duration;

      if (!yearlyMap.has(year)) {
        yearlyMap.set(year, { year, totalHours: 0, paidHours: 0, freeHours: 0, sessions: 0 });
      }
      const yearStats = yearlyMap.get(year)!;
      yearStats.totalHours += session.duration;
      yearStats.sessions++;
      if (session.isFree) yearStats.freeHours += session.duration;
      else yearStats.paidHours += session.duration;
    }

    return {
      monthlyStats: Array.from(monthlyMap.values()).sort((a, b) => b.month.localeCompare(a.month)),
      yearlyStats: Array.from(yearlyMap.values()).sort((a, b) => b.year.localeCompare(a.year)),
      availableYears: Array.from(yearsSet).sort((a, b) => b.localeCompare(a)),
      availableMonths: Array.from(monthsSet).sort((a, b) => b.localeCompare(a))
    };
  }, [allSessions]);

  // -----------------------------------------------------------------------
  // Filtered clients
  // -----------------------------------------------------------------------

  const filteredClients = useMemo(() => {
    let filtered = clients;

    if (!isSuperAdmin && currentUserEmail) {
      filtered = filtered.filter(client =>
        client.email === currentUserEmail || client.allEmails.includes(currentUserEmail)
      );
    }

    if (isSuperAdmin && searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(client =>
        client.email.toLowerCase().includes(q) ||
        client.allEmails.some(e => e.toLowerCase().includes(q)) ||
        client.name?.toLowerCase().includes(q) ||
        client.allNames.some(n => n.toLowerCase().includes(q))
      );
    }

    if (selectedYear !== "all" || selectedMonth !== "all") {
      filtered = filtered.map(client => {
        const filteredSessions = client.sessions.filter(s => {
          const sessionYear = s.date.substring(0, 4);
          const sessionMonth = s.date.substring(0, 7);
          if (selectedYear !== "all" && sessionYear !== selectedYear) return false;
          if (selectedMonth !== "all" && sessionMonth !== selectedMonth) return false;
          return true;
        });

        const totalHours = filteredSessions.reduce((sum, s) => sum + s.duration, 0);
        const paidHours = filteredSessions.filter(s => !s.isFree).reduce((sum, s) => sum + s.duration, 0);
        const freeHours = filteredSessions.filter(s => s.isFree).reduce((sum, s) => sum + s.duration, 0);

        return {
          ...client,
          sessions: filteredSessions,
          totalSessions: new Set(filteredSessions.map(s => s.date)).size,
          totalHours,
          totalPaidHours: paidHours,
          totalFreeHours: freeHours
        };
      }).filter(c => c.totalSessions > 0);
    }

    return filtered;
  }, [clients, searchTerm, selectedYear, selectedMonth, isSuperAdmin, currentUserEmail]);

  const globalStats = useMemo(() => ({
    totalClients: filteredClients.length,
    totalHours: filteredClients.reduce((sum, c) => sum + c.totalHours, 0),
    totalPaidHours: filteredClients.reduce((sum, c) => sum + c.totalPaidHours, 0),
    totalFreeHours: filteredClients.reduce((sum, c) => sum + c.totalFreeHours, 0),
    totalSessions: filteredClients.reduce((sum, c) => sum + c.totalSessions, 0),
  }), [filteredClients]);

  // Pending suggestions (not dismissed)
  const pendingSuggestions = useMemo(() => {
    return suggestedMerges.filter(s => {
      const key = [s.emailA, s.emailB].sort().join("|");
      return !dismissedSuggestions.has(key);
    });
  }, [suggestedMerges, dismissedSuggestions]);

  // -----------------------------------------------------------------------
  // UI helpers
  // -----------------------------------------------------------------------

  const toggleClientExpand = (email: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(email)) newExpanded.delete(email);
    else newExpanded.add(email);
    setExpandedClients(newExpanded);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const formatHours = (hours: number) => Math.round(hours * 10) / 10;

  const formatSimilarity = (sim: number) => `${Math.round(sim * 100)}%`;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-muted-foreground text-center">{progress || "Chargement..."}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-destructive mb-4">Erreur: {error}</p>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header for non-superadmins */}
      {!isSuperAdmin && (
        <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/30">
          <h3 className="text-lg font-display text-foreground">Ma Comptabilité</h3>
          <p className="text-sm text-muted-foreground">Historique de vos sessions au studio</p>
        </div>
      )}

      {/* ---- Merge Suggestions Banner ---- */}
      {isSuperAdmin && pendingSuggestions.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span className="font-semibold text-amber-400">
                {pendingSuggestions.length} fusion{pendingSuggestions.length > 1 ? "s" : ""} suggérée{pendingSuggestions.length > 1 ? "s" : ""}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMergeDialog(true)}
              className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
            >
              <Eye className="w-4 h-4 mr-1" />
              Voir
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Des clients avec des noms similaires ont été détectés (ex: fautes d'orthographe). 
            Cliquez "Voir" pour les fusionner.
          </p>
        </div>
      )}

      {/* ---- Active Merges Badge ---- */}
      {isSuperAdmin && Object.keys(merges).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary gap-1">
            <Link2 className="w-3 h-3" />
            {Object.keys(merges).length} fusion{Object.keys(merges).length > 1 ? "s" : ""} active{Object.keys(merges).length > 1 ? "s" : ""}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMergeManager(true)}
            className="text-xs text-muted-foreground"
          >
            <Edit3 className="w-3 h-3 mr-1" />
            Gérer les fusions
          </Button>
        </div>
      )}

      {/* ---- Merge Suggestions Dialog ---- */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="w-5 h-5 text-amber-500" />
              Suggestions de fusion de clients
            </DialogTitle>
            <DialogDescription>
              Ces clients ont des noms très similaires et pourraient être la même personne. 
              Fusionnez-les pour que leurs heures soient comptées ensemble.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {pendingSuggestions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucune suggestion en attente</p>
            ) : (
              pendingSuggestions.map((suggestion, idx) => (
                <div key={idx} className="p-4 rounded-lg border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                      Similarité: {formatSimilarity(suggestion.similarity)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                    <div className="p-3 rounded-lg bg-secondary/50 text-center">
                      <p className="font-medium text-foreground text-sm">{suggestion.nameA}</p>
                      <p className="text-xs text-muted-foreground truncate">{suggestion.emailA}</p>
                    </div>
                    <Link2 className="w-4 h-4 text-muted-foreground" />
                    <div className="p-3 rounded-lg bg-secondary/50 text-center">
                      <p className="font-medium text-foreground text-sm">{suggestion.nameB}</p>
                      <p className="text-xs text-muted-foreground truncate">{suggestion.emailB}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-green-500/50 text-green-500 hover:bg-green-500/10"
                          onClick={() => {
                            // Merge B into A (keep A as primary, more sessions = primary)
                            const clientA = rawClients.find(c => c.email === suggestion.emailA);
                            const clientB = rawClients.find(c => c.email === suggestion.emailB);
                            const aHours = clientA?.totalHours || 0;
                            const bHours = clientB?.totalHours || 0;
                            if (aHours >= bHours) {
                              applyMerge(suggestion.emailB, suggestion.emailA);
                            } else {
                              applyMerge(suggestion.emailA, suggestion.emailB);
                            }
                          }}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Fusionner
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Fusionner ces deux clients en un seul (le client avec le plus d'heures est gardé comme principal)
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => dismissSuggestion(suggestion.emailA, suggestion.emailB)}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Ignorer
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Ce ne sont pas les mêmes personnes, ne plus suggérer
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Merge Manager Dialog ---- */}
      <Dialog open={showMergeManager} onOpenChange={setShowMergeManager}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Gestion des fusions
            </DialogTitle>
            <DialogDescription>
              Voir et supprimer les fusions de clients actives. Vous pouvez aussi fusionner manuellement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Active merges */}
            {Object.keys(merges).length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Aucune fusion active</p>
            ) : (
              Object.entries(merges).map(([secondary, primary]) => {
                const primaryClient = rawClients.find(c => c.email === primary);
                const secondaryClient = rawClients.find(c => c.email === secondary);
                return (
                  <div key={secondary} className="p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="text-xs">
                          <p className="text-muted-foreground truncate">
                            <span className="text-foreground font-medium">{secondaryClient?.name || secondary}</span>
                          </p>
                          <p className="text-primary">→ fusionné dans</p>
                          <p className="text-foreground font-medium truncate">{primaryClient?.name || primary}</p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-destructive hover:bg-destructive/10"
                        onClick={() => removeMerge(secondary)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Manual merge */}
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Fusion manuelle</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Client à fusionner (secondaire)</label>
                  <Select value={manualMergeSource || ""} onValueChange={setManualMergeSource}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {rawClients
                        .filter(c => !merges[c.email])
                        .map(c => (
                          <SelectItem key={c.email} value={c.email}>
                            {c.name || c.email} ({formatHours(c.totalHours)}h)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Fusionner dans (principal)</label>
                  <Select value={manualMergeTarget} onValueChange={setManualMergeTarget}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir le client principal..." />
                    </SelectTrigger>
                    <SelectContent>
                      {rawClients
                        .filter(c => c.email !== manualMergeSource && !merges[c.email])
                        .map(c => (
                          <SelectItem key={c.email} value={c.email}>
                            {c.name || c.email} ({formatHours(c.totalHours)}h)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={!manualMergeSource || !manualMergeTarget}
                  onClick={() => {
                    if (manualMergeSource && manualMergeTarget) {
                      applyMerge(manualMergeSource, manualMergeTarget);
                      setManualMergeSource(null);
                      setManualMergeTarget("");
                    }
                  }}
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Fusionner
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeManager(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========= TABS ========= */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {isSuperAdmin && (
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Par Client
            </TabsTrigger>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Comptabilité Générale
            </TabsTrigger>
          </TabsList>
        )}

        {/* ---- Client Tab ---- */}
        <TabsContent value="clients" className="space-y-6">
          {/* Global Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card border-primary/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-display text-foreground">{globalStats.totalClients}</p>
                    <p className="text-xs text-muted-foreground">Clients</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-accent/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-display text-foreground">{formatHours(globalStats.totalHours)}h</p>
                    <p className="text-xs text-muted-foreground">Heures totales</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-green-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-display text-foreground">{formatHours(globalStats.totalPaidHours)}h</p>
                    <p className="text-xs text-muted-foreground">Heures payantes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-purple-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-display text-foreground">{formatHours(globalStats.totalFreeHours)}h</p>
                    <p className="text-xs text-muted-foreground">Heures offertes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {isSuperAdmin ? (
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un client (nom, email)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            ) : (
              <div className="flex-1" />
            )}

            <div className="flex gap-2 flex-wrap">
              {isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMergeManager(true)}
                  className="gap-1"
                >
                  <Link2 className="w-4 h-4" />
                  Fusions
                  {Object.keys(merges).length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1">
                      {Object.keys(merges).length}
                    </Badge>
                  )}
                </Button>
              )}

              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Mois" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les mois</SelectItem>
                  {availableMonths.map(month => {
                    const monthDate = new Date(month + "-01");
                    const label = monthDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
                    return (
                      <SelectItem key={month} value={month}>
                        {label.charAt(0).toUpperCase() + label.slice(1)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={fetchData} disabled={loading}>
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Client List */}
          <div className="space-y-3">
            {filteredClients.length === 0 ? (
              <Card className="bg-card">
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Aucun client trouvé</p>
                </CardContent>
              </Card>
            ) : (
              filteredClients.map((client) => (
                <Card key={client.email} className={cn("bg-card", client.isMerged && "border-primary/30")}>
                  <CardContent className="p-0">
                    <div
                      onClick={() => toggleClientExpand(client.email)}
                      className="p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            client.isMerged ? "bg-primary/30" : "bg-primary/20"
                          )}>
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">
                                {client.name || client.email}
                              </p>
                              {client.isMerged && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-primary/10 border-primary/30 text-primary gap-1">
                                      <Link2 className="w-3 h-3" />
                                      {client.allEmails.length}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-semibold mb-1">Clients fusionnés :</p>
                                    {client.allEmails.map(e => (
                                      <p key={e} className="text-xs">{e}</p>
                                    ))}
                                    {client.allNames.length > 1 && (
                                      <>
                                        <p className="font-semibold mt-2 mb-1">Variantes de noms :</p>
                                        {client.allNames.map((n, i) => (
                                          <p key={i} className="text-xs">{n}</p>
                                        ))}
                                      </>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground">{client.email}</p>
                              {client.allNames.length > 1 && (
                                <p className="text-xs text-muted-foreground italic">
                                  (aussi: {client.allNames.filter(n => n !== client.name).join(", ")})
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="font-display text-lg text-foreground">{formatHours(client.totalHours)}h</p>
                            <p className="text-xs text-muted-foreground">
                              {formatHours(client.totalPaidHours)}h payées
                              {client.totalFreeHours > 0 && (
                                <span className="text-purple-400"> + {formatHours(client.totalFreeHours)}h offertes</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-display text-lg text-foreground">{client.totalSessions}</p>
                            <p className="text-xs text-muted-foreground">sessions</p>
                          </div>
                          {expandedClients.has(client.email) ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>

                    {expandedClients.has(client.email) && (
                      <div className="border-t border-border p-4 bg-secondary/20">
                        {/* Show merged emails info */}
                        {client.isMerged && (
                          <div className="mb-3 p-2 rounded-lg bg-primary/5 border border-primary/20">
                            <p className="text-xs text-primary flex items-center gap-1">
                              <Link2 className="w-3 h-3" />
                              Données fusionnées de {client.allEmails.length} comptes : {client.allEmails.join(", ")}
                            </p>
                          </div>
                        )}

                        <div className="space-y-3">
                          {client.sessions.map((session) => (
                            <div
                              key={session.id}
                              className={cn(
                                "p-3 rounded-lg border bg-card flex items-center justify-between gap-4",
                                session.isFree ? "border-purple-500/30" : "border-border/50"
                              )}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Badge variant="outline" className="shrink-0">
                                  {session.startHour}h-{session.endHour}h
                                </Badge>
                                {session.isFree && (
                                  <Badge variant="outline" className="shrink-0 bg-purple-500/20 text-purple-400 border-purple-500/30">
                                    <Gift className="w-3 h-3 mr-1" />
                                    Gratuit
                                  </Badge>
                                )}
                                <span className="text-sm text-foreground truncate">
                                  {session.title.replace(/\[FREE\]/gi, "").trim()}
                                </span>
                                {/* Show original email if different from primary (merged) */}
                                {client.isMerged && session.originalClientEmail && session.originalClientEmail !== client.email && (
                                  <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
                                    via {session.originalClientEmail}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-sm text-muted-foreground">
                                  {formatDate(session.date)}
                                </span>
                                <span className="font-display text-lg text-foreground">
                                  {formatHours(session.duration)}h
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/30">
                          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                            <span className="text-muted-foreground">
                              1ère session: {client.firstSession && formatDate(client.firstSession)}
                            </span>
                            <span className="text-muted-foreground">
                              Dernière: {client.lastSession && formatDate(client.lastSession)}
                            </span>
                            <span className="font-display text-lg text-primary">
                              {formatHours(client.totalHours)}h au total
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ---- General Accounting Tab ---- */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Statistiques par Année
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {yearlyStats.map(stat => (
                  <div key={stat.year} className="p-4 rounded-lg border border-border bg-secondary/20">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xl font-display text-foreground">{stat.year}</h4>
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {stat.sessions} sessions
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-2xl font-display text-foreground">{formatHours(stat.totalHours)}h</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Payantes</p>
                        <p className="text-2xl font-display text-green-500">{formatHours(stat.paidHours)}h</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Offertes</p>
                        <p className="text-2xl font-display text-purple-500">{formatHours(stat.freeHours)}h</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Statistiques par Mois
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {monthlyStats.map(stat => (
                  <div key={stat.month} className="p-3 rounded-lg border border-border/50 bg-card flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-foreground min-w-[150px]">{stat.label}</span>
                      <Badge variant="outline">{stat.sessions} sessions</Badge>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="text-sm text-muted-foreground">Total: </span>
                        <span className="font-display text-foreground">{formatHours(stat.totalHours)}h</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-green-500">{formatHours(stat.paidHours)}h</span>
                        <span className="text-sm text-muted-foreground"> / </span>
                        <span className="text-sm text-purple-500">{formatHours(stat.freeHours)}h</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminClientAccounting;
