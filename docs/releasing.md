# Releasing

```sh
npm version patch   # or minor / major: checks, tests, bumps, commits and tags
git push --follow-tags
```

The `v*` tag starts the Release workflow: it checks that the tag matches
`package.json`, runs the checks and tests, builds the package, attaches it to a
GitHub release and submits it to the Chrome Web Store. The store job runs only
once the `CWS_ITEM_ID` variable is set, in the `chrome-web-store` GitHub
environment, where approval rules can be added.

The store accepts only a higher version than the one it already has, and its
API can only update an existing item. The first version is therefore uploaded
by hand, together with the listing from [`store/listing.md`](../store/listing.md);
set `CWS_ITEM_ID` afterwards.

## Chrome Web Store access

Publishing uses the Chrome Web Store API v2 with a service account and Workload
Identity Federation: GitHub's OIDC token is exchanged for a short-lived access
token, so no keys or refresh tokens are stored anywhere.

The Google Cloud side is shared by all of the publisher's extensions, because a
publisher can have only one service account. One Google Cloud project holds:

- the Chrome Web Store, IAM, IAM Credentials and STS APIs, enabled;
- a service account with no IAM roles, added in the Developer Dashboard under
  **Settings → Account**;
- a Workload Identity pool `github` with an OIDC provider that accepts only
  repositories of the owner's numeric GitHub user ID (unlike a login, it can
  never be taken over by someone else):

  ```sh
  gcloud iam workload-identity-pools create github --location=global
  gcloud iam workload-identity-pools providers create-oidc OWNER \
    --location=global \
    --workload-identity-pool=github \
    --issuer-uri=https://token.actions.githubusercontent.com \
    --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner_id=assertion.repository_owner_id \
    --attribute-condition="assertion.repository_owner_id == 'GITHUB_USER_ID'"
  ```

Each repository is then allowed to impersonate the service account on its own:

```sh
gcloud iam service-accounts add-iam-policy-binding SERVICE_ACCOUNT_EMAIL \
  --role=roles/iam.workloadIdentityUser \
  --member=principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/OWNER/REPOSITORY
```

The workflow reads the account details from repository secrets (**Settings →
Secrets and variables → Actions**), so they stay out of the repository and are
masked in the public workflow logs:

| Name | Kind | Value |
| --- | --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | secret | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/OWNER` |
| `CWS_SERVICE_ACCOUNT` | secret | The service account's email |
| `CWS_PUBLISHER_ID` | secret | Developer Dashboard → **Settings** |
| `CWS_ITEM_ID` | variable | The extension's ID, public in its store URL; publishing stays off while it is unset |
