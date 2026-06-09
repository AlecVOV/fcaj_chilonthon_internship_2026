// Supabase Edge Function: approve-user
// Triggered when admin approves a pending user registration request.
// Uses supabase.auth.admin.inviteUserByEmail() to send invite link.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req: Request) => {
  try {
    const { requestId } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Get the pending request
    const { data: reqData, error: fetchError } = await supabaseAdmin
      .from('user_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchError || !reqData) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (reqData.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Request already processed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 2. Invite user via Supabase Auth Admin API (sends invite email)
    const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin
      .inviteUserByEmail(reqData.email, {
        data: { full_name: reqData.full_name },
      })

    if (inviteError) {
      console.error('Invite error:', inviteError)
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3. Update request status
    await supabaseAdmin
      .from('user_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    // 4. Set requires_password_change on the new profile
    if (authData?.user?.id) {
      await supabaseAdmin
        .from('profiles')
        .update({ requires_password_change: true })
        .eq('id', authData.user.id)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
