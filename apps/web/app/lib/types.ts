export interface FounderSocials {
  linkedin?: string
  twitter?: string
  github?: string
  email?: string
}

export interface Company {
  slug: string
  name: string
  batch: string
  category: string
  description: string
  website?: string
  founders: Record<string, FounderSocials>
  logoUrl?: string
  location?: string
  teamSize?: string
  scrapedAt: string
}

export interface ScrapeResponse {
  jobId: string
}

export interface JobStatus {
  status: "pending" | "running" | "done" | "failed"
  total?: number
  processed?: number
  error?: string
}
