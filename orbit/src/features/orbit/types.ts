import type { LocationSettings } from "./location-settings";
export type Gender = "Woman" | "Man" | "Non-binary" | "Self-described";
export type RoundStatus =
  "open" | "closed" | "matching" | "ready" | "published" | "failed";
export interface User {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
}
export interface Round {
  id: string;
  title: string;
  status: RoundStatus;
  closes_at: number;
}
export interface Profile {
  country: string;
  outside_country: boolean;
  openrouter_consent: boolean;
  age: number | "";
  city: string;
  occupation: string;
  gender: Gender | "";
  orientation: string;
  intention: "Dating" | "Friendship" | "";
  seeking: Gender[];
  min_age: number;
  max_age: number;
  any_city: boolean;
  bio: string;
}
export interface Question {
  id: number;
  text: string;
  options: { id: string; text: string }[];
}
export type Answers = Record<string, string>;
export interface Match {
  name: string;
  age: number;
  city: string;
  occupation: string;
  score: number;
  shared: string[];
  explanation: string;
  icebreaker: string;
}
export interface Dashboard {
  location_settings?: LocationSettings;
  round: Round;
  has_profile: boolean;
  answered: number;
  submitted: boolean;
  matches: Match[];
  profile?: Profile;
  answers?: Answers;
}
export interface AdminDashboard {
  location_settings?: LocationSettings;
  round: Round;
  participants: number;
  submitted: number;
  emails_pending: number;
  events: { action: string; created_at: number }[];
  job?: { status: string };
  database?: string;
  cache?: string;
  email_configured?: boolean;
}
export interface Dialog {
  requirePassword?: boolean;
  title: string;
  paragraphs: string[];
  label?: string;
  action?: () => void | Promise<void>;
}
