import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function firstRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (relation == null) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let billId: unknown;
  let token: unknown;
  try {
    ({ billId, token } = await request.json());
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
  if (
    typeof billId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      billId
    ) ||
    typeof token !== "string" ||
    !/^[0-9a-f]{64}$/i.test(token)
  ) {
    return jsonResponse({ error: "Invalid report link" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Public report function is missing Supabase server credentials");
    return jsonResponse({ error: "Report service is not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: bill, error: billError } = await supabase
    .from("bills")
    .select(
      `
      id, bill_no, bill_date, patient_name, patient_title, patient_age_years,
      patient_age_months, patient_age_days, patient_gender, ref_by, company_name,
      final_amount, paid_amount, remaining_amount, report_access_token,
      centers(center_name, is_out_medical),
      bill_items(
        id, test_id, package_id,
        tests(test_name, specimen, footer_text),
        packages(package_name),
        test_report_headers(status, comments_result, special_notes)
      )
    `
    )
    .eq("id", billId)
    .eq("report_access_token", token)
    .maybeSingle();

  if (billError) {
    console.error("Could not load a public report:", billError.message);
    return jsonResponse({ error: "Could not load this report" }, 500);
  }
  if (!bill) {
    return jsonResponse({ error: "This report link is invalid or expired" }, 404);
  }

  const remainingAmount = Number(bill.remaining_amount) || 0;
  if (remainingAmount > 0.01) {
    return jsonResponse(
      { status: "payment_required", remainingAmount },
      402
    );
  }

  const readyItems = (bill.bill_items || []).filter((item) => {
    const header = Array.isArray(item.test_report_headers)
      ? item.test_report_headers[0]
      : item.test_report_headers;
    return header?.status?.toLowerCase() === "ready";
  });
  if (readyItems.length === 0) {
    return jsonResponse({ status: "report_not_ready" }, 409);
  }

  const reports = await Promise.all(
    readyItems.map(async (item) => {
      const [resultsResponse, subcategoriesResponse] = await Promise.all([
        supabase
          .from("test_results")
          .select(
            `
            subcategory_id,
            value, unit, status, comments,
            test_subcategories(subcategory_name)
          `
          )
          .eq("bill_item_id", item.id)
          .order("created_at", { ascending: true }),
        item.test_id
          ? supabase
              .from("test_subcategories")
              .select("id, subcategory_name")
              .eq("test_id", item.test_id)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);
      const { data: results, error: resultsError } = resultsResponse;
      const { data: subcategories, error: subcategoriesError } =
        subcategoriesResponse;

      if (resultsError) throw resultsError;
      if (subcategoriesError) throw subcategoriesError;
      const header = Array.isArray(item.test_report_headers)
        ? item.test_report_headers[0]
        : item.test_report_headers;
      const subcategoryIds = (results || [])
        .map((result) => result.subcategory_id)
        .filter(Boolean);
      const { data: ranges, error: rangesError } = subcategoryIds.length
        ? await supabase
            .from("reference_ranges")
            .select("subcategory_id, gender, min_value, max_value, unit")
            .in("subcategory_id", subcategoryIds)
        : { data: [], error: null };
      if (rangesError) throw rangesError;

      const title = (bill.patient_title || "").toLowerCase().replace(/\./g, "");
      const preferredGender = ["mr", "dr", "master", "rev"].includes(title)
        ? "Male"
        : ["miss", "mrs"].includes(title)
          ? "Female"
          : null;
      type TestResult = NonNullable<typeof results>[number];
      const resultRowsBySubcategory = new Map<
        string | null,
        TestResult[]
      >();
      (results || []).forEach((result) => {
        const existing = resultRowsBySubcategory.get(result.subcategory_id) || [];
        existing.push(result);
        resultRowsBySubcategory.set(result.subcategory_id, existing);
      });
      const formatResult = (result: TestResult, name: string) => ({
        name,
        value: result.value || "",
        unit: result.unit || "",
        remark: result.comments || "",
        referenceRange: (() => {
          const available = (ranges || []).filter(
            (range) => range.subcategory_id === result.subcategory_id
          );
          const selected =
            (preferredGender &&
              available.find((range) => range.gender === preferredGender)) ||
            available[0];
          if (!selected) return "";
          const min = selected.min_value == null ? "" : String(selected.min_value).trim();
          const max = selected.max_value == null ? "" : String(selected.max_value).trim();
          const core = min && max ? `${min} - ${max}` : min || max;
          return core
            ? `${core}${selected.unit ? ` ${selected.unit}` : ""}`
            : "";
        })(),
      });
      const resultRows = (subcategories || []).flatMap((subcategory) => {
        const matchingResults = resultRowsBySubcategory.get(subcategory.id) || [];
        if (matchingResults.length === 0) {
          return [{
            name: subcategory.subcategory_name || "",
            value: "",
            unit: "",
            remark: "",
            referenceRange: "",
          }];
        }
        return matchingResults.map((result) =>
          formatResult(result, subcategory.subcategory_name || "")
        );
      });
      const knownSubcategoryIds = new Set(
        (subcategories || []).map((subcategory) => subcategory.id)
      );
      const unmatchedResults = (results || []).filter(
        (result) => !knownSubcategoryIds.has(result.subcategory_id)
      );
      const test = firstRelation(item.tests);
      const packageInfo = firstRelation(item.packages);
      return {
        testName: test?.test_name || packageInfo?.package_name || "Report",
        specimen: test?.specimen || "",
        footerImage: test?.footer_text || "",
        comments: header?.comments_result || "",
        specialNotes: header?.special_notes || "",
        results: [
          ...resultRows,
          ...unmatchedResults.map((result) =>
            formatResult(
              result,
              firstRelation(result.test_subcategories)?.subcategory_name || ""
            )
          ),
        ],
      };
    })
  ).catch((error) => {
    console.error("Could not load public report results:", error.message);
    return null;
  });

  if (!reports) {
    return jsonResponse({ error: "Could not load report results" }, 500);
  }

  const center = firstRelation(bill.centers);
  return jsonResponse({
    status: "ready",
    bill: {
      billNo: bill.bill_no,
      billDate: bill.bill_date,
      patientName: bill.patient_name,
      patientTitle: bill.patient_title,
      ageYears: bill.patient_age_years,
      ageMonths: bill.patient_age_months,
      ageDays: bill.patient_age_days,
      gender: bill.patient_gender,
      requestedBy: bill.ref_by,
      centerName: center?.center_name || "",
      companyName: bill.company_name || "",
      isOutMedical: center?.is_out_medical === true,
    },
    reports,
  });
});
