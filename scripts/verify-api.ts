
// Verified with native fetch

const BASE_URL = 'http://localhost:5000';
let TOKEN = '';

async function login() {
    console.log('Logging in...');
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin@smartagencyhub.com', password: 'password123' })
    });

    if (!res.ok) {
        console.error('Login failed:', await res.text());
        process.exit(1);
    }

    const data = await res.json();
    TOKEN = data.token;
    console.log('Login successful. Token acquired.');
}

async function verifyFolders() {
    console.log('\n--- Verifying Folders ---');

    // 1. Create Folder
    console.log('Creating "Test Verification Folder"...');
    const createRes = await fetch(`${BASE_URL}/api/lead-folders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({ name: 'Test Verification Folder', color: '#6366f1' })
    });

    if (!createRes.ok) throw new Error(await createRes.text());
    const folder = await createRes.json();
    console.log('Folder created:', folder.id, folder.name);

    // 2. Create Lead
    console.log('Creating Test Lead...');
    const leadRes = await fetch(`${BASE_URL}/api/leads`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({
            name: 'Test Lead',
            email: 'test@example.com',
            phone: '1234567890',
            status: 'new',
            followUpDate: '2025-01-01'
        })
    });

    if (!leadRes.ok) throw new Error(await leadRes.text());
    const lead = await leadRes.json();
    console.log('Lead created:', lead.id);

    // 3. Move Lead to Folder
    console.log('Moving Lead to Folder...');
    const moveRes = await fetch(`${BASE_URL}/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({ folderId: folder.id })
    });
    if (!moveRes.ok) throw new Error(await moveRes.text());
    console.log('Lead moved.');

    // 4. Verify Lead in Folder
    console.log('Verifying Lead in Folder...');
    const listRes = await fetch(`${BASE_URL}/api/leads?folderId=${folder.id}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const leadsInFolder = await listRes.json();
    const found = leadsInFolder.some((l: any) => l.id === lead.id);
    console.log(`Lead found in folder query: ${found}`);
    if (!found) throw new Error("Lead not found in folder!");

    return folder.id;
}

async function verifyTemplates(folderId: string) {
    console.log('\n--- Verifying Templates ---');

    // 1. Create Template
    console.log('Creating "Test Template"...');
    const tplRes = await fetch(`${BASE_URL}/api/email-templates`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({
            name: 'Verify Template',
            subject: 'Hello {{lead.name}}',
            message: 'Hi {{lead.name}},\nThis is a test from {{user.name}}.'
        })
    });

    if (!tplRes.ok) throw new Error(await tplRes.text());
    const template = await tplRes.json();
    console.log('Template created:', template.id);

    // 2. Fetch Templates
    console.log('Fetching Templates...');
    const listRes = await fetch(`${BASE_URL}/api/email-templates`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const templates = await listRes.json();
    const found = templates.some((t: any) => t.id === template.id);
    console.log(`Template found in list: ${found}`);
    if (!found) throw new Error("Template not found!");
}

async function main() {
    try {
        await login();
        const folderId = await verifyFolders();
        await verifyTemplates(folderId);
        console.log('\n✅ Verification Complete!');
    } catch (error) {
        console.error('\n❌ Verification Failed:', error);
        process.exit(1);
    }
}

main();
