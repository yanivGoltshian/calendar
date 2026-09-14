import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  SMS_SECRET_ENV,
  SMS_PUBLIC_ENV,
  CURRENT_QUERY,
  parseInputs,
  prepare,
} from '../../../scripts/prepare-messaging-deployment.mjs';

const names = {
  SMS4FREE_API_KEY: 'sms4free-api-key',
  SMS4FREE_USER: 'sms4free-user',
  SMS4FREE_PASS: 'sms4free-pass',
  SMS4FREE_SENDER: 'sms4free-sender',
};
const enabled = {
  MESSAGING_PROVIDER: 'sms4free',
  SMS4FREE_SECRET_NAMES: JSON.stringify(names),
};

function current(provider = 'console', configured = false) {
  return {
    name: 'torchick-app-prod',
    secretNames: configured ? Object.values(names) : [],
    externalSecretNames: [] as string[],
    containers: [
      {
        name: 'torchick-app-prod',
        selectors: [{ name: 'SMS_PROVIDER', value: provider }],
        bindings: configured
          ? Object.entries(names).map(([name, secretRef]) => ({
              name,
              secretRef,
              hasValue: false,
            }))
          : [],
        settings: [] as { name: string; value: string }[],
      },
    ],
  };
}

test('SMS deployment: defaults retain console and emit no SMS secret bindings', () => {
  const result = prepare({}, () => current());
  assert.deepEqual(result.parameters, {
    messagingProvider: { value: 'console' },
    sms4freeSecretNames: { value: null },
    messagingConfig: { value: {} },
  });
});

test('SMS deployment: complete existing enabled connection survives repeated preparation', () => {
  const state = current('sms4free', true);
  const first = prepare(enabled, () => state);
  assert.deepEqual(
    first,
    prepare(enabled, () => state),
  );
  assert.deepEqual(first.parameters.sms4freeSecretNames.value, names);
  assert.equal(first.parameters.messagingProvider.value, 'sms4free');
});

test('SMS deployment: complete staged bindings remain inactive under console', () => {
  const result = prepare({ ...enabled, MESSAGING_PROVIDER: 'console' }, () =>
    current('console', true),
  );
  assert.equal(result.parameters.messagingProvider.value, 'console');
  assert.deepEqual(result.parameters.sms4freeSecretNames.value, names);
});

test('SMS deployment: preferred selector and legacy aliases follow runtime precedence', () => {
  for (const alias of ['sms4free', 'sms-il', 'sms_il', ' SMS4FREE ']) {
    assert.equal(
      prepare({ ...enabled, MESSAGING_PROVIDER: alias }, () => current(alias, true))
        .parameters.messagingProvider.value,
      'sms4free',
    );
  }
  assert.equal(
    parseInputs({ ...enabled, MESSAGING_PROVIDER: 'console', SMS_PROVIDER: 'sms4free' })
      .provider,
    'console',
  );
  const state = current('sms4free', true);
  state.containers[0].selectors.push({ name: 'MESSAGING_PROVIDER', value: 'console' });
  assert.doesNotThrow(() =>
    prepare({ ...enabled, MESSAGING_PROVIDER: 'console' }, () => state),
  );
});

test('SMS deployment: missing, partial and malformed inputs fail before any metadata call', () => {
  const invalid: Record<string, string>[] = [
    { MESSAGING_PROVIDER: 'sms4free' },
    { ...enabled, SMS4FREE_SECRET_NAMES: 'null' },
    { ...enabled, SMS4FREE_SECRET_NAMES: '{' },
    { ...enabled, SMS4FREE_SECRET_NAMES: '[]' },
    { ...enabled, SMS4FREE_SECRET_NAMES: JSON.stringify({ ...names, EXTRA: 'extra' }) },
    {
      ...enabled,
      SMS4FREE_SECRET_NAMES: JSON.stringify({ ...names, SMS4FREE_PASS: ' ' }),
    },
    {
      ...enabled,
      SMS4FREE_SECRET_NAMES: JSON.stringify({
        ...names,
        SMS4FREE_PASS: names.SMS4FREE_API_KEY,
      }),
    },
    {
      ...enabled,
      SMS4FREE_SECRET_NAMES: JSON.stringify({ ...names, SMS4FREE_PASS: 'database-url' }),
    },
  ];
  for (const key of SMS_SECRET_ENV) {
    invalid.push({
      ...enabled,
      SMS4FREE_SECRET_NAMES: JSON.stringify(
        Object.fromEntries(Object.entries(names).filter(([name]) => name !== key)),
      ),
    });
  }
  for (const env of invalid) {
    let reads = 0;
    assert.throws(() =>
      prepare(env, () => {
        reads++;
        return current();
      }),
    );
    assert.equal(reads, 0);
  }
});

test('SMS deployment: JSON diagnostics withhold invalid input values', () => {
  const marker = 'SYNTHETIC_PRIVATE_INPUT';
  assert.throws(
    () => parseInputs({ SMS4FREE_SECRET_NAMES: `{"${marker}"` }),
    (error: Error) =>
      !error.message.includes(marker) && error.message.includes('valid JSON'),
  );
});

test('SMS deployment: enabled provider without persisted inputs blocks default downgrade', () => {
  assert.throws(
    () => prepare({}, () => current('sms4free', true)),
    /cannot change the provider/,
  );
  assert.throws(() => prepare({}, () => current('console', true)), /discard existing/);
  const staged = current();
  staged.secretNames.push(...Object.values(names));
  assert.throws(() => prepare({}, () => staged), /staged secrets/);
});

test('SMS deployment: preflight refuses activation, changed names, missing store entries and partial current state', () => {
  assert.throws(
    () => prepare(enabled, () => current('console', true)),
    /cannot change the provider/,
  );
  const renamed = {
    ...enabled,
    SMS4FREE_SECRET_NAMES: JSON.stringify({ ...names, SMS4FREE_PASS: 'replacement' }),
  };
  const state = current('sms4free', true);
  state.secretNames.push('replacement');
  assert.throws(() => prepare(renamed, () => state), /dedicated secret names/);
  for (const key of SMS_SECRET_ENV) {
    const missing = current('sms4free', true);
    missing.secretNames = missing.secretNames.filter(
      (name) => name !== names[key as keyof typeof names],
    );
    assert.throws(
      () => prepare(enabled, () => missing),
      /absent from the existing runtime store/,
    );
    const partial = current('sms4free', true);
    partial.containers[0].bindings = partial.containers[0].bindings.filter(
      (item) => item.name !== key,
    );
    assert.throws(() => prepare(enabled, () => partial), /partial/);
  }
});

test('SMS deployment: inline or duplicate current bindings and unknown metadata fail closed', () => {
  const inline = current('sms4free', true);
  inline.containers[0].bindings[0].hasValue = true;
  assert.throws(() => prepare(enabled, () => inline), /inline credentials/);
  const duplicate = current('sms4free', true);
  duplicate.containers[0].bindings.push(duplicate.containers[0].bindings[0]);
  assert.throws(() => prepare(enabled, () => duplicate), /duplicate/);
  assert.throws(() => prepare(enabled, () => null), /metadata/);
  const external = current('sms4free', true);
  external.externalSecretNames.push(names.SMS4FREE_API_KEY);
  assert.throws(
    () => prepare(enabled, () => external),
    /directly stored runtime secrets/,
  );
});

test('SMS deployment: optional SMS endpoint configuration is retained explicitly', () => {
  const config = Object.fromEntries(
    SMS_PUBLIC_ENV.map((key) => [key, `synthetic-${key}`]),
  );
  const state = current('sms4free', true);
  state.containers[0].settings = Object.entries(config).map(([name, value]) => ({
    name,
    value,
  }));
  assert.throws(() => prepare(enabled, () => state), /change a public setting/);
  assert.deepEqual(
    prepare({ ...enabled, MESSAGING_CONFIG: JSON.stringify(config) }, () => state)
      .parameters.messagingConfig.value,
    config,
  );
  for (const key of [...SMS_SECRET_ENV, 'MESSAGING_PROVIDER', 'SMS_PROVIDER']) {
    assert.throws(
      () => parseInputs({ MESSAGING_CONFIG: JSON.stringify({ [key]: 'synthetic' }) }),
      /public messaging settings/,
    );
  }
});

const whatsAppConfig = {
  WHATSAPP_PHONE_NUMBER_ID: 'synthetic-phone-id',
  WHATSAPP_OTP_TEMPLATE: 'synthetic-template',
  WHATSAPP_BUSINESS_ACCOUNT_ID: 'synthetic-account-id',
  WHATSAPP_OTP_TEMPLATE_LANG: 'he',
  WHATSAPP_OTP_BUTTON_SUBTYPE: 'url',
  WHATSAPP_GRAPH_VERSION: 'v21.0',
  WHATSAPP_GRAPH_BASE_URL: 'https://graph.example.invalid',
  WHATSAPP_DEFAULT_COUNTRY_CODE: '972',
};

function configuredWhatsApp(config = whatsAppConfig) {
  const state = current('whatsapp-cloud');
  state.containers[0].settings = Object.entries(config).map(([name, value]) => ({
    name,
    value,
  }));
  return state;
}

test('Messaging deployment: omitted WhatsApp public settings cannot be erased by the overlay', () => {
  assert.throws(
    () => prepare({ MESSAGING_PROVIDER: 'whatsapp-cloud' }, configuredWhatsApp),
    /public setting/,
  );
  for (const omitted of Object.keys(whatsAppConfig)) {
    const config = Object.fromEntries(
      Object.entries(whatsAppConfig).filter(([name]) => name !== omitted),
    );
    assert.throws(
      () =>
        prepare(
          {
            MESSAGING_PROVIDER: 'whatsapp-cloud',
            MESSAGING_CONFIG: JSON.stringify(config),
          },
          configuredWhatsApp,
        ),
      /public setting/,
    );
  }
});

test('Messaging deployment: changed WhatsApp public settings fail retention', () => {
  for (const changed of Object.keys(whatsAppConfig)) {
    assert.throws(
      () =>
        prepare(
          {
            MESSAGING_PROVIDER: 'whatsapp-cloud',
            MESSAGING_CONFIG: JSON.stringify({ ...whatsAppConfig, [changed]: 'changed' }),
          },
          configuredWhatsApp,
        ),
      /public setting/,
    );
  }
});

test('Messaging deployment: unchanged complete WhatsApp public settings survive the overlay', () => {
  const result = prepare(
    {
      MESSAGING_PROVIDER: 'whatsapp-cloud',
      MESSAGING_CONFIG: JSON.stringify(whatsAppConfig),
    },
    configuredWhatsApp,
  );
  assert.deepEqual(result.parameters.messagingConfig.value, whatsAppConfig);
  assert.equal(result.parameters.messagingProvider.value, 'whatsapp-cloud');
  assert.equal(result.parameters.sms4freeSecretNames.value, null);
});

const noButtonConfig = { ...whatsAppConfig, WHATSAPP_OTP_BUTTON_SUBTYPE: '' };

test('Messaging deployment: unchanged empty no-button setting is retained', () => {
  const result = prepare(
    {
      MESSAGING_PROVIDER: 'whatsapp-cloud',
      MESSAGING_CONFIG: JSON.stringify(noButtonConfig),
    },
    () => configuredWhatsApp(noButtonConfig),
  );
  assert.deepEqual(result.parameters.messagingConfig.value, noButtonConfig);
});

test('Messaging deployment: omitted empty no-button setting fails retention', () => {
  const config = Object.fromEntries(
    Object.entries(noButtonConfig).filter(
      ([name]) => name !== 'WHATSAPP_OTP_BUTTON_SUBTYPE',
    ),
  );
  assert.throws(
    () =>
      prepare(
        {
          MESSAGING_PROVIDER: 'whatsapp-cloud',
          MESSAGING_CONFIG: JSON.stringify(config),
        },
        () => configuredWhatsApp(noButtonConfig),
      ),
    /public setting/,
  );
});

test('Messaging deployment: changed empty no-button setting fails retention', () => {
  assert.throws(
    () =>
      prepare(
        {
          MESSAGING_PROVIDER: 'whatsapp-cloud',
          MESSAGING_CONFIG: JSON.stringify(whatsAppConfig),
        },
        () => configuredWhatsApp(noButtonConfig),
      ),
    /public setting/,
  );
});

test('Messaging deployment: public settings still require string values', () => {
  for (const value of [null, 0, false, [], {}]) {
    assert.throws(
      () =>
        parseInputs({
          MESSAGING_CONFIG: JSON.stringify({ WHATSAPP_OTP_BUTTON_SUBTYPE: value }),
        }),
      /public messaging settings/,
    );
  }
});

test('Messaging deployment: the actual metadata projection includes every documented public setting', () => {
  const settingsFilter = CURRENT_QUERY.split('settings:env[?')[1].split('].{')[0];
  const projectedNames = [...settingsFilter.matchAll(/name=='([^']+)'/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(
    projectedNames.sort(),
    [...SMS_PUBLIC_ENV, ...Object.keys(whatsAppConfig)].sort(),
  );
});

test('SMS deployment: CLI rejects incomplete configuration without invoking Azure or writing output', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/prepare-messaging-deployment.mjs',
      '--output',
      '/unused-messaging-output.json',
    ],
    {
      env: { PATH: '', NODE_ENV: 'test', MESSAGING_PROVIDER: 'sms4free' },
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires all four/);
  assert.equal(result.stdout, '');
});

test('SMS deployment: workflow preflight precedes mutation and passes names-only overlay', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  assert.ok(
    workflow.indexOf('node scripts/prepare-messaging-deployment.mjs') <
      workflow.indexOf('uses: azure/arm-deploy@'),
  );
  assert.ok(workflow.includes('${{ runner.temp }}/messaging.parameters.json'));
  assert.ok(workflow.includes("vars.MESSAGING_PROVIDER || 'console'"));
  assert.ok(!/secrets\.SMS4FREE_/.test(workflow));
  assert.ok(
    CURRENT_QUERY.includes('secretNames:properties.configuration.secrets[].name'),
  );
  assert.ok(!CURRENT_QUERY.includes('secrets[].value'));
  assert.ok(CURRENT_QUERY.includes('hasValue:value!=`null`'));
});

test('SMS deployment: compiled ARM keeps four-name schema and secure runtime resolution', () => {
  const raw = readFileSync('infra/main.json', 'utf8');
  const doc = JSON.parse(raw);
  assert.equal(doc.parameters.messagingProvider.defaultValue, 'console');
  assert.equal(doc.parameters.sms4freeSecretNames.nullable, true);
  for (const key of SMS_SECRET_ENV) {
    assert.equal(doc.parameters.sms4freeSecretNames.properties[key].type, 'string');
    assert.deepEqual(doc.parameters.sms4freeSecretNames.properties[key].allowedValues, [
      names[key as keyof typeof names],
    ]);
  }
  assert.equal(doc.parameters.sms4freeSecretNames.additionalProperties, false);
  const modules = Object.values(doc.resources) as {
    properties?: {
      template?: {
        parameters?: Record<string, { type: string; defaultValue?: unknown }>;
      };
    };
  }[];
  const container = modules.find(
    (item) => item.properties?.template?.parameters?.sms4freeSecrets,
  );
  assert.equal(
    container?.properties?.template?.parameters?.sms4freeSecrets.type,
    'secureObject',
  );
  assert.deepEqual(
    container?.properties?.template?.parameters?.sms4freeSecrets.defaultValue,
    {},
  );
  assert.ok(raw.includes('listSecrets('));
  assert.ok(raw.includes("if(empty(parameters('sms4freeSecretNames')), createArray(),"));
  assert.ok(raw.includes("variables('sms4freeSecretValues')"));
  assert.ok(raw.includes("variables('sms4freeSecretEnv')"));
  assert.ok(raw.includes("lambdaVariables('secret').name"));
  assert.ok(raw.includes("'secretRef'"));
  assert.ok(!raw.includes('SMS4FREE_API_KEY=value'));
  assert.equal(doc.resources.currentApp.existing, true);
  assert.deepEqual(doc.resources.containerApp.dependsOn, ['containerEnv']);
  const resolution =
    doc.resources.containerApp.properties.parameters.sms4freeSecrets.value;
  assert.ok(resolution.includes("listSecrets('currentApp', '2024-03-01')"));
  assert.ok(!resolution.includes("reference('containerApp')"));
  assert.ok(!JSON.stringify(doc.outputs).includes('sms4free'));
  assert.ok(
    !JSON.stringify(doc.resources.containerApp.properties.template.outputs).includes(
      'sms4free',
    ),
  );
});
