// Shared workspace shapes. Kept free of server-only imports so client components
// can use them too.

export type FormularyRow = {
  id: string
  chemicalName: string
  preferredGeneric: string | null
  preferredDin: string | null
  alternateGeneric: string | null
  alternateDin: string | null
  notes: string | null
}

export type ContentRow = {
  id: string
  section: string
  title: string
  body: string | null
}

export type WorkspaceData = {
  formulary: FormularyRow[]
  content: ContentRow[]
}
