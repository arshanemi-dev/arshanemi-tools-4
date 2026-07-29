// Maps the string icon names stored in lib/permissions.js (JSON-safe) back to
// renderable lucide-react components. Shared by Sidebar.jsx (client) and
// settings/page.js (server) so both render the same icon for the same route.
import { Building2, Users, Settings, Briefcase, Palette, UserCircle } from 'lucide-react'

export const NAV_ICONS = {
  Building2, Users, Settings, Briefcase, Palette, UserCircle,
}
