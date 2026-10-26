# Multi-center staff access

This change lets one staff login be assigned to multiple laboratory centers and
choose the center whose reports they are entering. Existing users' `center_id`
assignments are copied into the new `admin_user_centers` mapping table.

## Setup

1. Back up the Supabase database.
2. Run `database/multi_center_user_access.sql` in the Supabase SQL Editor.
3. Deploy the updated application.
4. In **Admin User Management**, edit each staff account and select all centers
   where that person is authorized to enter reports. Select one of those
   centers as the **Main center**; it is saved in `admin_users.center_id`.
5. At **Report Entry**, the staff member selects the active center. The bill
   list is then limited to that center. The main center is selected by default,
   and a different authorized center can be selected when needed. The current
   selection is remembered for the browser session.
6. Have users sign out and sign back in so their browser session reloads the
   current center assignments.

Existing single-center users continue to have their current center assigned
after the migration. Admin users retain the existing all-centers behavior.

## Security note

The current application authenticates by comparing credentials in the browser
against `admin_users` and stores the resulting user object in `sessionStorage`.
The existing database policies also permit anonymous access. Therefore, the
center selection and assignment checks in this change improve the workflow but
are **not a security boundary** against a modified browser client. Do not treat
this as production-grade center isolation. A separate migration to Supabase
Auth, server-side user provisioning, and `auth.uid()`-based RLS policies for
center-owned data is required before relying on these assignments to protect
patient data.
