// Title: Read-Only Demo Accounts DB Test
// Path: src/test/db/demo-readonly.db.test.ts
// Functionality: Verifies listed demo accounts can read but not write, on RPC and direct paths (20261126000000).

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createAdmin, createResident, deleteUser, serviceClient, signedInClient } from './harness';

const DEMO_MESSAGE = 'Demo mode: changes are disabled.';

describe.skipIf(!hasDbEnv())('read-only demo accounts (20261126000000)', () => {
  const users: string[] = [];

  afterEach(async () => {
    // demo_readonly_accounts rows cascade with the auth user.
    while (users.length) { const id = users.pop(); if (id) await deleteUser(id); }
  });

  async function markReadOnly(userId: string): Promise<void> {
    const { error } = await serviceClient().from('demo_readonly_accounts').insert({ user_id: userId });
    if (error) throw new Error(`demo flag insert: ${error.message}`);
  }

  const manualEvent = {
    p_domain: 'system',
    p_action_type: 'DEMO_CHECK',
    p_severity: 'info',
    p_description: 'read-only demo check',
  };

  // tx_create_manual_event is superadmin-only, so it proves the RPC path with the strongest role.
  it('blocks RPC writes by a read-only superadmin while reads keep working', async () => {
    const admin = await createAdmin({ superadmin: true }); users.push(admin.id);
    await markReadOnly(admin.id);
    const client = await signedInClient(admin.email, admin.password);

    const { data: flagged } = await client.rpc('is_demo_readonly');
    expect(flagged).toBe(true);

    const { error: writeError } = await client.rpc('tx_create_manual_event', manualEvent);
    expect(writeError?.message).toContain(DEMO_MESSAGE);

    const { data: profile, error: readError } = await client.from('profiles').select('id').eq('id', admin.id).single();
    expect(readError).toBeNull();
    expect(profile?.id).toBe(admin.id);
  });

  it('blocks direct own-profile updates by a read-only resident', async () => {
    const resident = await createResident({ approve: true }); users.push(resident.id);
    await markReadOnly(resident.id);
    const client = await signedInClient(resident.email, resident.password);

    const { error } = await client.from('profiles').update({ full_name: 'Changed By Demo' }).eq('id', resident.id);
    expect(error?.message).toContain(DEMO_MESSAGE);
  });

  it('leaves accounts that are not listed writable', async () => {
    const admin = await createAdmin({ superadmin: true }); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);

    const { data: flagged } = await client.rpc('is_demo_readonly');
    expect(flagged).toBe(false);

    const { error } = await client.rpc('tx_create_manual_event', manualEvent);
    expect(error).toBeNull();
  });

  it('does not let clients add or remove read-only entries', async () => {
    const admin = await createAdmin(); users.push(admin.id);
    await markReadOnly(admin.id);
    const client = await signedInClient(admin.email, admin.password);

    const { error: insertError } = await client.from('demo_readonly_accounts').insert({ user_id: admin.id });
    expect(insertError).not.toBeNull();

    await client.from('demo_readonly_accounts').delete().eq('user_id', admin.id);
    const { data: still } = await serviceClient().from('demo_readonly_accounts').select('user_id').eq('user_id', admin.id);
    expect(still).toHaveLength(1);
  });
});
