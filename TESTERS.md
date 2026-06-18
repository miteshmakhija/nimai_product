# NimAI RFQ Generator — Test Accounts

All accounts are seeded automatically on every backend startup. Passwords are set at first creation and updated to `can_approve` state on subsequent restarts (safe to run repeatedly).

## Login URL
```
http://localhost:5173
```

---

## Test Users

| Name | Email | Password | Role | Can Approve | Notes |
|---|---|---|---|---|---|
| Super Admin | `admin@nimai.ai` | `password!123` | super_admin | ✅ | Full access + manage users |
| Alice Finance | `alice.finance@nimai.ai` | `Test@1234` | admin | ✅ | Primary approver — Finance stage |
| Bob Engineering | `bob.engineering@nimai.ai` | `Test@1234` | admin | ✅ | Secondary approver — Engineering stage |
| Carol Director | `carol.director@nimai.ai` | `Test@1234` | admin | ✅ | Primary approver — Director sign-off |
| Dave Sales | `dave.sales@nimai.ai` | `Test@1234` | end_user | ✅ | Approver with no admin role |
| Eve Procurement | `eve.procurement@nimai.ai` | `Test@1234` | end_user | ✅ | Approver with no admin role |
| Frank Viewer | `frank.viewer@nimai.ai` | `Test@1234` | end_user | ❌ | Can submit RFQs, cannot approve |
| Grace Submitter | `grace.submitter@nimai.ai` | `Test@1234` | end_user | ❌ | Can submit RFQs, cannot approve |

---

## Suggested Test Scenario — Multi-stage with Primary/Secondary

**Goal:** test the Finance → Director 2-stage approval flow with a fallback approver.

1. Log in as **Grace Submitter** → Generate an RFQ → complete all 3 steps until the run is `done`
2. On the RunDetail page click **Set up approval**
3. Click **Add stage** to build two stages:

   | Stage | Name | Primary | Secondary | Quorum |
   |---|---|---|---|---|
   | 1 | Finance Sign-off | Alice Finance | Dave Sales | 1 of 2 (any one is enough) |
   | 2 | Regional Director | Carol Director | Bob Engineering | 1 of 2 |

4. Submit for approval
5. Log in as **Alice Finance** → Approvals → approve or reject
   - If approved: flow moves to Stage 2 automatically
   - If rejected: bounces back and Carol/Grace are notified
6. Log in as **Carol Director** → approve Stage 2 → run becomes `approved`

---

## Approval Template — set up once as admin

1. Log in as **admin@nimai.ai** → Administration → Approval Templates → New template
2. Create template **"Standard 2-stage"**:
   - Stage 1: `Finance Sign-off`, quorum 1, hint `Finance`
   - Stage 2: `Regional Director`, quorum 1, hint `Management`
3. When any submitter clicks "Set up approval", they can now click **Load template → Standard 2-stage** to pre-fill the stage names and quorum, then just pick the actual people.

---

## Role summary

| Role | Generate RFQ | Submit for approval | Approve/Reject | Admin pages | Manage users |
|---|---|---|---|---|---|
| `super_admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | if `can_approve` | ✅ | ❌ |
| `end_user` | ✅ | ✅ | if `can_approve` | ❌ | ❌ |
