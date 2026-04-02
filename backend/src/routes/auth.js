// dealiq/backend/src/routes/auth.js

import { supabase } from '../lib/clients.js'
import { sendWelcomeEmail, sendMagicLinkEmail } from '../services/email.js'
import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'

export default async function authRoutes(app) {

  // ── SIGN UP ──────────────────────────────────────────────
  app.post('/signup', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'full_name', 'org_name'],
        properties: {
          email:     { type: 'string', format: 'email' },
          password:  { type: 'string', minLength: 8 },
          full_name: { type: 'string' },
          org_name:  { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password, full_name, org_name } = request.body

    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email confirmation for now
    })
    if (authError) return reply.status(400).send({ error: authError.message })

    const userId = authData.user.id

    // 2. Create organization
    const slug = org_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + nanoid(4)
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: org_name,
        slug,
        plan: 'trial',
        trial_ends_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (orgError) return reply.status(500).send({ error: 'Could not create organization.' })

    // 3. Create user profile
    const { error: userError } = await supabase.from('users').insert({
      id: userId,
      org_id: org.id,
      email,
      full_name,
      role: 'admin', // first user is admin
    })

    if (userError) return reply.status(500).send({ error: 'Could not create user profile.' })

    // 4. Send welcome email (async — don't block response)
    sendWelcomeEmail({ email, full_name, org_name }).catch(console.error)

    // 5. Sign in and return session
    const { data: session, error: sessionError } = await supabase.auth.signInWithPassword({ email, password })
    if (sessionError) return reply.status(500).send({ error: 'Signup succeeded but could not sign in.' })

    return reply.send({
      user: { id: userId, email, full_name, role: 'admin' },
      org: { id: org.id, name: org_name, slug, plan: 'trial' },
      session: session.session,
    })
  })

  // ── LOGIN ─────────────────────────────────────────────────
  app.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return reply.status(401).send({ error: 'Invalid email or password.' })

    // Fetch user profile + org
    const { data: userProfile } = await supabase
      .from('users')
      .select('*, organizations(*)')
      .eq('id', data.user.id)
      .single()

    // Update last active
    await supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', data.user.id)

    return reply.send({
      user: userProfile,
      org: userProfile.organizations,
      session: data.session,
    })
  })

  // ── MAGIC LINK (send OTP) ─────────────────────────────────
  app.post('/magic-link', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email' } },
      },
    },
  }, async (request, reply) => {
    const { email } = request.body

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${process.env.FRONTEND_URL}/auth/verify`,
      },
    })

    // Always return success (don't leak whether email exists)
    return reply.send({ message: 'Check your email for a sign-in link.' })
  })

  // ── GOOGLE SSO CALLBACK ───────────────────────────────────
  app.post('/sso/google', async (request, reply) => {
    const { access_token } = request.body

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: access_token,
    })

    if (error) return reply.status(401).send({ error: error.message })

    // Check if user profile exists, if not create one (new Google signup)
    const { data: existingUser } = await supabase
      .from('users')
      .select('*, organizations(*)')
      .eq('id', data.user.id)
      .single()

    if (!existingUser) {
      // New user via Google — create org + profile
      const orgName = data.user.user_metadata?.name?.split(' ')[0] + "'s Team" || 'My Team'
      const slug    = 'team-' + nanoid(8)

      const { data: org } = await supabase.from('organizations').insert({
        name: orgName, slug, plan: 'trial',
        trial_ends_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      }).select().single()

      await supabase.from('users').insert({
        id: data.user.id,
        org_id: org.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name,
        avatar_url: data.user.user_metadata?.avatar_url,
        role: 'admin',
      })
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('*, organizations(*)')
      .eq('id', data.user.id)
      .single()

    return reply.send({ user: userProfile, org: userProfile.organizations, session: data.session })
  })

  // ── LOGOUT ────────────────────────────────────────────────
  app.post('/logout', { onRequest: [app.authenticate] }, async (request, reply) => {
    const token = request.headers.authorization?.split(' ')[1]
    await supabase.auth.admin.signOut(token)
    return reply.send({ message: 'Logged out.' })
  })

  // ── ME (get current user) ─────────────────────────────────
  app.get('/me', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { data: user } = await supabase
      .from('users')
      .select('*, organizations(*)')
      .eq('id', request.user.sub)
      .single()

    if (!user) return reply.status(404).send({ error: 'User not found.' })
    return reply.send({ user, org: user.organizations })
  })
}
