/**
 * Crosscheck — quiz response sheet
 *
 * Paste this entire file into a Google Apps Script project bound to a
 * Google Sheet. It accepts POST submissions from the Crosscheck quiz at
 * /quiz/[slug] and serves them back as JSON for the admin view.
 *
 * ─────────── ONE-TIME SETUP ───────────
 *
 * 1. Create a new Google Sheet. Note its URL — you don't need the ID
 *    because this script uses the bound spreadsheet.
 *
 * 2. In the Sheet: Extensions → Apps Script. Delete any boilerplate.
 *
 * 3. Paste this entire file. Save.
 *
 * 4. Deploy → New deployment → Type: Web app
 *    - Description: "Crosscheck quiz endpoint"
 *    - Execute as: Me (your account)
 *    - Who has access: Anyone (yes, anyone — the URL is the secret)
 *    Copy the deployment URL — looks like:
 *      https://script.google.com/macros/s/AKfy.../exec
 *
 * 5. In your Vercel project (and locally in .env.local) set:
 *      QUIZ_WEBHOOK_URL=https://script.google.com/macros/s/AKfy.../exec
 *
 * 6. Send your founder the link: <your-domain>/quiz/founder
 *    Submissions append a row to this sheet automatically.
 *    Visit <your-domain>/admin/quiz/founder to see them.
 *
 * ─────────── HOW THE SHEET FILLS ───────────
 *
 * One sheet (tab) per quiz slug, auto-created on first submission.
 * Columns:
 *   A · submittedAt (ISO timestamp)
 *   B · respondent name
 *   C · userAgent
 *   D…  one column per question (header = question id)
 *   answers JSON in last column for safety
 */

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var slug = String(payload.quizSlug || "unknown").slice(0, 100);
    var sheet = getOrCreateSheet_(slug);
    appendRow_(sheet, payload);
    return jsonResponse_({ ok: true });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    var slug = (e && e.parameter && e.parameter.slug) || "founder";
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(slug);
    if (!sheet) {
      return jsonResponse_({ ok: true, slug: slug, rows: [] });
    }
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return jsonResponse_({ ok: true, slug: slug, rows: [] });
    }
    var headers = values[0];
    var rows = [];
    for (var i = 1; i < values.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = values[i][j];
      }
      // Try to parse the answers JSON column back into an object
      if (typeof row.answers_json === "string" && row.answers_json) {
        try {
          row.answers = JSON.parse(row.answers_json);
        } catch (_) {
          // ignore
        }
      }
      rows.push(row);
    }
    return jsonResponse_({ ok: true, slug: slug, rows: rows });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function getOrCreateSheet_(slug) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(slug);
  if (!sheet) {
    sheet = ss.insertSheet(slug);
    sheet.appendRow([
      "submittedAt",
      "respondent",
      "userAgent",
      "answers_json",
    ]);
  }
  return sheet;
}

function appendRow_(sheet, payload) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  // Ensure each answered question has its own column for easy spreadsheet analysis
  var answers = payload.answers || {};
  Object.keys(answers).forEach(function (qid) {
    if (headers.indexOf(qid) === -1) {
      sheet.getRange(1, headers.length + 1).setValue(qid);
      headers.push(qid);
    }
  });
  // Build the row in header order
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    if (h === "submittedAt") row.push(payload.submittedAt || new Date().toISOString());
    else if (h === "respondent") row.push(payload.respondent || "");
    else if (h === "userAgent") row.push(payload.userAgent || "");
    else if (h === "answers_json") row.push(JSON.stringify(answers));
    else row.push(answers[h] || "");
  }
  sheet.appendRow(row);
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
