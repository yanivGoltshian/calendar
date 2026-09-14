import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const SMS_SECRET_ENV = [
  'SMS4FREE_API_KEY',
  'SMS4FREE_USER',
  'SMS4FREE_PASS',
  'SMS4FREE_SENDER',
];
const SECRET_NAMES = {
  SMS4FREE_API_KEY: 'sms4free-api-key',
  SMS4FREE_USER: 'sms4free-user',
  SMS4FREE_PASS: 'sms4free-pass',
  SMS4FREE_SENDER: 'sms4free-sender',
};
export const SMS_PUBLIC_ENV = [
  'SMS4FREE_BASE_URL',
  'SMS4FREE_SEND_PATH',
  'SMS_DEFAULT_COUNTRY_CODE',
];
const PUBLIC_ENV = new Set([
  ...SMS_PUBLIC_ENV,
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_OTP_TEMPLATE',
  'WHATSAPP_BUSINESS_ACCOUNT_ID',
  'WHATSAPP_OTP_TEMPLATE_LANG',
  'WHATSAPP_OTP_BUTTON_SUBTYPE',
  'WHATSAPP_GRAPH_VERSION',
  'WHATSAPP_GRAPH_BASE_URL',
  'WHATSAPP_DEFAULT_COUNTRY_CODE',
]);

function fail(message) {
  throw new Error(message);
}

function objectJson(raw, label) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    fail(`${label} must be valid JSON; input values are withheld.`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
  return value;
}

export function providerName(value) {
  const name = value.trim().toLowerCase();
  if (['sms4free', 'sms-il', 'sms_il'].includes(name)) return 'sms4free';
  if (['whatsapp-cloud', 'whatsapp', 'whatsapp_cloud'].includes(name))
    return 'whatsapp-cloud';
  if (name === '' || name === 'console') return 'console';
  fail('Unsupported messaging provider; input value is withheld.');
}

export function parseInputs(env) {
  const provider = providerName(env.MESSAGING_PROVIDER ?? env.SMS_PROVIDER ?? 'console');
  const names = env.SMS4FREE_SECRET_NAMES
    ? objectJson(env.SMS4FREE_SECRET_NAMES, 'SMS4FREE_SECRET_NAMES')
    : null;
  if (names !== null) {
    if (
      Object.keys(names).length !== 4 ||
      !SMS_SECRET_ENV.every((key) => names[key] === SECRET_NAMES[key])
    ) {
      fail(
        'SMS4FREE_SECRET_NAMES requires the four dedicated secret names from the deployment contract.',
      );
    }
  }
  if (provider === 'sms4free' && names === null)
    fail('SMS4Free requires all four secret-name bindings.');
  const config = objectJson(env.MESSAGING_CONFIG || '{}', 'MESSAGING_CONFIG');
  if (
    Object.entries(config).some(
      ([key, value]) =>
        !PUBLIC_ENV.has(key) || typeof value !== 'string' || !value.trim(),
    )
  ) {
    fail('MESSAGING_CONFIG accepts only documented nonempty public messaging settings.');
  }
  return { provider, names, config };
}

// This query never asks Azure for secret values or inline SMS credentials.
export const CURRENT_QUERY =
  "{name:name,secretNames:properties.configuration.secrets[].name,externalSecretNames:properties.configuration.secrets[?keyVaultUrl!=`null`].name,containers:properties.template.containers[].{name:name,selectors:env[?name=='MESSAGING_PROVIDER' || name=='SMS_PROVIDER'].{name:name,value:value},bindings:env[?starts_with(name,'SMS4FREE_') || name=='SMS_DEFAULT_COUNTRY_CODE'].{name:name,secretRef:secretRef,hasValue:value!=`null`},settings:env[?name=='SMS4FREE_BASE_URL' || name=='SMS4FREE_SEND_PATH' || name=='SMS_DEFAULT_COUNTRY_CODE'].{name:name,value:value}}}";

export function validateRetention(input, current) {
  if (
    !current ||
    !Array.isArray(current.secretNames) ||
    !Array.isArray(current.externalSecretNames) ||
    !Array.isArray(current.containers) ||
    current.containers.length !== 1 ||
    current.containers[0].name !== current.name
  ) {
    fail(
      'Current Container App metadata does not match the single-container deployment contract.',
    );
  }
  const container = current.containers[0];
  if (
    ![container.selectors, container.bindings, container.settings].every(Array.isArray)
  ) {
    fail('Current messaging metadata is incomplete.');
  }
  const selectors = Object.fromEntries(
    container.selectors.map((item) => [item.name, item.value]),
  );
  if (
    new Set(container.selectors.map((item) => item.name)).size !==
      container.selectors.length ||
    Object.values(selectors).some((value) => typeof value !== 'string')
  ) {
    fail('Current provider selectors must be unique plain settings.');
  }
  const currentProvider = providerName(
    selectors.MESSAGING_PROVIDER ?? selectors.SMS_PROVIDER ?? 'console',
  );
  if (currentProvider !== input.provider) {
    fail(
      'Routine infrastructure deployment cannot change the provider. Use the separately approved staged activation or rollback.',
    );
  }
  const bindings = container.bindings.filter((item) =>
    SMS_SECRET_ENV.includes(item.name),
  );
  if (
    new Set(container.bindings.map((item) => item.name)).size !==
      container.bindings.length ||
    container.bindings.some(
      (item) => ![...SMS_SECRET_ENV, ...SMS_PUBLIC_ENV].includes(item.name),
    )
  ) {
    fail('Current SMS settings contain duplicate or unmanaged bindings.');
  }
  if (bindings.length && bindings.length !== 4)
    fail('Current SMS4Free bindings are partial; reconcile before deployment.');
  if (
    input.names === null &&
    (bindings.length ||
      Object.values(SECRET_NAMES).some((name) => current.secretNames.includes(name)))
  )
    fail('Deployment would discard existing SMS4Free bindings or staged secrets.');
  if (input.names !== null) {
    if (SMS_SECRET_ENV.some((key) => !current.secretNames.includes(input.names[key]))) {
      fail('An SMS4Free secret name is absent from the existing runtime store.');
    }
    if (
      Object.values(SECRET_NAMES).some((name) =>
        current.externalSecretNames.includes(name),
      )
    ) {
      fail(
        'SMS4Free requires directly stored runtime secrets; external secret references need separate review.',
      );
    }
    if (
      bindings.length !== 4 ||
      bindings.some((item) => item.hasValue || item.secretRef !== input.names[item.name])
    ) {
      fail(
        'SMS4Free binding changes require separate approved staging; inline credentials are unsupported.',
      );
    }
  }
  for (const key of SMS_PUBLIC_ENV) {
    const existing = container.settings.find((item) => item.name === key);
    if (existing?.value !== input.config[key]) {
      fail(
        'Deployment would change an SMS4Free public setting. Reconcile the explicit configuration first.',
      );
    }
  }
}

export function prepare(env, readCurrent) {
  const input = parseInputs(env);
  validateRetention(input, readCurrent());
  return {
    $schema:
      'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#',
    contentVersion: '1.0.0.0',
    parameters: {
      messagingProvider: { value: input.provider },
      sms4freeSecretNames: { value: input.names },
      messagingConfig: { value: input.config },
    },
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      output: { type: 'string' },
      'check-input': { type: 'boolean' },
    },
  });
  parseInputs(process.env);
  if (values['check-input']) return;
  if (
    !values.output ||
    !process.env.AZURE_RESOURCE_GROUP ||
    !process.env.AZURE_CONTAINER_APP
  ) {
    fail(
      'Set AZURE_RESOURCE_GROUP, AZURE_CONTAINER_APP and --output for the metadata preflight.',
    );
  }
  const parameters = prepare(process.env, () => {
    let raw;
    try {
      raw = execFileSync(
        'az',
        [
          'containerapp',
          'show',
          '--resource-group',
          process.env.AZURE_RESOURCE_GROUP,
          '--name',
          process.env.AZURE_CONTAINER_APP,
          '--query',
          CURRENT_QUERY,
          '--output',
          'json',
          '--only-show-errors',
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch {
      fail(
        'Container App metadata read failed. Check the existing target and read access; deployment is blocked.',
      );
    }
    return objectJson(raw, 'Current Container App metadata');
  });
  writeFileSync(values.output, `${JSON.stringify(parameters, null, 2)}\n`, {
    mode: 0o600,
    flag: 'wx',
  });
  console.log(
    'Messaging deployment preflight passed. Output contains public configuration and secret names only.',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Messaging deployment preflight failed.',
    );
    process.exitCode = 1;
  }
}
