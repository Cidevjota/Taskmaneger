// RETIRED. This was a one-off backfill that moved base64 creative images out of
// tasks.design_briefing into the `attachments` Storage bucket. It ran once on
// 2026-07-21, migrating 24 images across 7 tasks.
//
// The migration logic was removed rather than left callable, since re-running an
// unused data-rewriting endpoint is pure downside. Safe to delete this function
// entirely from the Supabase dashboard.
//
// Backup of the pre-migration column: public.design_briefing_backup_20260721
// Ongoing uploads are handled client-side by src/lib/deliveryImages.ts.

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(() =>
  new Response(
    JSON.stringify({
      status: 'retired',
      message:
        'Migração de imagens de criativos já concluída em 2026-07-21. Esta função não faz mais nada.',
    }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  )
);
