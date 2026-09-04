// Shared server-side plumbing for the appointment and custom-jewelry forms.
// Both flows create a Shopify customer via the Storefront API, then record
// the submission on that customer's admin-defined metafields (namespace
// "custom" — the definitions already exist in admin; none are created
// here). Metafields and file uploads are Admin-API-only, so those calls use
// PRIVATE_ADMIN_API_TOKEN (custom app: read_customers + write_customers;
// uploadReferenceImage additionally needs write_files).

type AdminResult = {
  data?: any;
  errors?: Array<{message: string}>;
};

const LOG = '[customer-metafields]';

export async function adminRequest(
  env: Env,
  query: string,
  variables: Record<string, unknown>,
): Promise<AdminResult> {
  const token = env.PRIVATE_ADMIN_API_TOKEN;

  if (!token) {
    console.error(`${LOG} PRIVATE_ADMIN_API_TOKEN is not configured`);
    return {errors: [{message: 'PRIVATE_ADMIN_API_TOKEN is not configured'}]};
  }

  const response = await fetch(
    `https://${env.PUBLIC_STORE_DOMAIN}/admin/api/2026-01/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({query, variables}),
    },
  );

  if (!response.ok) {
    console.error(`${LOG} Admin API HTTP error:`, response.status);
    return {errors: [{message: `Admin API HTTP ${response.status}`}]};
  }

  return (await response.json()) as AdminResult;
}

// Writes values onto the customer's custom.* metafields. Empty values are
// skipped, and no explicit `type` is sent — metafieldsSet then validates
// each write against the definition's actual type in admin, so the code
// can't drift out of sync with definition changes. customerCreate only
// returns an id for a brand-new customer; for a returning one (TAKEN) the
// id is resolved by email here, so no duplicate customer is ever created.
export async function saveCustomerMetafields(
  env: Env,
  customerId: string | undefined,
  email: string,
  values: Record<string, string>,
): Promise<boolean> {
  let ownerId = customerId;

  if (!ownerId) {
    const lookup = await adminRequest(env, CUSTOMER_BY_EMAIL_QUERY, {
      query: `email:"${email.replace(/["\\]/g, '')}"`,
    });

    if (lookup.errors?.length) {
      console.error(
        `${LOG} customer lookup failed:`,
        JSON.stringify(lookup.errors[0]),
      );
      return false;
    }

    ownerId = lookup.data?.customers?.nodes?.[0]?.id as string | undefined;
  }

  if (!ownerId) {
    console.error(`${LOG} customer could not be resolved for metafields`);
    return false;
  }

  const metafields = Object.entries(values)
    .filter(([, value]) => value)
    .map(([key, value]) => ({ownerId, namespace: 'custom', key, value}));

  const result = await adminRequest(env, METAFIELDS_SET_MUTATION, {
    metafields,
  });

  const failure =
    result.data?.metafieldsSet?.userErrors?.[0] ?? result.errors?.[0];

  if (failure) {
    console.error(`${LOG} metafieldsSet:`, JSON.stringify(failure));
    return false;
  }

  return true;
}

/**
 * Creates one "Customer record" metaobject entry per submission — the
 * system of record since the per-field customer metafield definitions were
 * replaced by it. Returns the new entry's GID so the caller can point the
 * customer's custom.customer_details reference at it, or undefined on
 * failure. Empty fields are skipped. Needs the write_metaobjects scope.
 */
export async function createCustomerRecord(
  env: Env,
  fields: Record<string, string>,
): Promise<string | undefined> {
  const result = await adminRequest(env, METAOBJECT_CREATE_MUTATION, {
    metaobject: {
      type: 'customer_record',
      fields: Object.entries(fields)
        .filter(([, value]) => value)
        .map(([key, value]) => ({key, value})),
    },
  });

  const failure =
    result.data?.metaobjectCreate?.userErrors?.[0] ?? result.errors?.[0];
  if (failure) {
    console.error(`${LOG} metaobjectCreate:`, JSON.stringify(failure));
    return undefined;
  }

  return result.data?.metaobjectCreate?.metaobject?.id as string | undefined;
}

// Uploads a visitor-provided image into Shopify Files (staged upload, then
// fileCreate) and returns the file GID for a file_reference metafield.
// Requires the custom app to have the write_files scope.
export async function uploadReferenceImage(
  env: Env,
  file: File,
  alt: string,
): Promise<string | undefined> {
  const staged = await adminRequest(env, STAGED_UPLOADS_MUTATION, {
    input: [
      {
        resource: 'FILE',
        filename: file.name || 'reference-image',
        mimeType: file.type,
        fileSize: String(file.size),
        httpMethod: 'POST',
      },
    ],
  });

  const target = staged.data?.stagedUploadsCreate?.stagedTargets?.[0];
  const stagedFailure =
    staged.data?.stagedUploadsCreate?.userErrors?.[0] ?? staged.errors?.[0];

  if (!target || stagedFailure) {
    console.error(
      `${LOG} staged upload failed:`,
      JSON.stringify(stagedFailure ?? {message: 'no staged target returned'}),
    );
    return undefined;
  }

  // Google Cloud Storage target: the returned parameters become form
  // fields, and the file itself must be the last field appended.
  const body = new FormData();
  for (const {name, value} of target.parameters as Array<{
    name: string;
    value: string;
  }>) {
    body.append(name, value);
  }
  body.append('file', file);

  const uploaded = await fetch(target.url as string, {method: 'POST', body});

  if (!uploaded.ok) {
    console.error(`${LOG} file upload HTTP error:`, uploaded.status);
    return undefined;
  }

  const created = await adminRequest(env, FILE_CREATE_MUTATION, {
    files: [{originalSource: target.resourceUrl, contentType: 'IMAGE', alt}],
  });

  const createFailure =
    created.data?.fileCreate?.userErrors?.[0] ?? created.errors?.[0];
  const fileId = created.data?.fileCreate?.files?.[0]?.id as
    | string
    | undefined;

  if (!fileId || createFailure) {
    console.error(
      `${LOG} fileCreate failed:`,
      JSON.stringify(createFailure ?? {message: 'no file id returned'}),
    );
    return undefined;
  }

  return fileId;
}

// Admin API operations — plain strings, NOT #graphql-tagged, so Hydrogen's
// codegen never tries to validate them against the Storefront schema.
const CUSTOMER_BY_EMAIL_QUERY = `
  query BookingCustomerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      nodes {
        id
      }
    }
  }
`;

const METAFIELDS_SET_MUTATION = `
  mutation BookingCustomerMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        key
        value
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const METAOBJECT_CREATE_MUTATION = `
  mutation BookingCustomerRecord($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const STAGED_UPLOADS_MUTATION = `
  mutation BookingStagedUpload($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const FILE_CREATE_MUTATION = `
  mutation BookingFileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
      }
      userErrors {
        field
        message
      }
    }
  }
`;
