import data from "./opportunities.json";

export interface Classification {
  question_id: number; // 1–5, maps to q1–q5
  alignment: "left" | "right" | "neutral";
}

export interface Opportunity {
  id: string;
  title: string;
  problem: string;
  description: string;
  classifications: Classification[];
}

export const ALL_OPPORTUNITIES: Opportunity[] = data as Opportunity[];
