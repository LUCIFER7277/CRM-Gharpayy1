import { PGS } from "@/property-genius/data/pgs"
import type { Lead } from "@/lib/types"

export function leadHasValidProperty(lead: Pick<Lead, "preferredArea">): boolean {
  if (!lead.preferredArea?.trim()) return false
  const area = lead.preferredArea.toLowerCase()
  return PGS.some(
    (p) =>
      p.area.toLowerCase().includes(area) ||
      area.includes(p.area.toLowerCase()) ||
      p.name.toLowerCase().includes(area) ||
      area.includes(p.name.toLowerCase()),
  )
}

export function randomPropertyFromHub(): { area: string; name: string } {
  const pg = PGS[Math.floor(Math.random() * PGS.length)]
  return { area: pg.area, name: pg.name }
}

export function pickBestPropertyForLead(
  lead: Pick<Lead, "preferredArea">,
): { area: string; name: string } {
  if (!lead.preferredArea?.trim()) return randomPropertyFromHub()

  const area = lead.preferredArea.toLowerCase().trim()

  const matches = PGS.filter(
    (p) =>
      p.area.toLowerCase().includes(area) ||
      area.includes(p.area.toLowerCase()) ||
      p.name.toLowerCase().includes(area) ||
      area.includes(p.name.toLowerCase()),
  )

  if (matches.length > 0) {
    const pg = matches[Math.floor(Math.random() * matches.length)]
    return { area: pg.area, name: pg.name }
  }

  return randomPropertyFromHub()
}
