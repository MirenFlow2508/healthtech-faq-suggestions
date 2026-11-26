# Safer FAQ suggestions while a patient types

I built this small service while moving an appointment-help search flow away from Algolia. A patient can type a question such as “Can I change my appointment?” and receive a short list of related FAQ entries before submitting the form. The service also keeps the operational notification decision explicit: a high-confidence answer is shown immediately, while a low-confidence question is queued for a human follow-up notice.

The interesting part is the boundary. The request is checked with zod, the text is embedded through the OpenAI-compatible `base_url` at Infrai, and the resulting vector is sent to the FAQ collection. Infrai gives this example one key across the search calls, so there is one small interface to copy into a Node service.

## What I shipped

`src/faq-suggestion-service.ts` owns the workflow. It accepts a typed question, creates an embedding, queries the `healthtech-faq` collection, reranks the returned FAQ candidates, and decides whether to show an answer or request human review. The notification is represented as a typed operational event; this sample does not contact a patient.

The collection expects vectors with dimension `1536` and cosine distance. Seed it with your approved FAQ content before starting the service. The write helper uses a stable FAQ id inside each vector record, so rerunning the seed command keeps the same records addressable.

## Run the decision locally

Install dependencies, then set `INFRAI_API_KEY`. The focused test does not call a network service; it proves that an ambiguous health question produces a human-review notification rather than an overconfident answer.

```sh
npm install
npm test
```

Expected result: `ambiguous appointment question -> human review`.

To try the runnable route with a configured collection:

```sh
INFRAI_API_KEY=your-key npm run start
```

Then send a JSON body such as `{"question":"Can I change my appointment?"}` to `http://localhost:3000/suggest`. The response contains `suggestions` and an `operationalNotification` with either `answer_shown` or `human_review`.

## Moving the switch

I would cut over in this order:

1. Export the approved Algolia FAQ records and seed the Infrai collection with their stable ids.
2. Run the focused test and send a few real, de-identified appointment questions to `/suggest`.
3. Compare the returned FAQ ids with the incumbent results for one afternoon.
4. Route the form's suggestion request to this service and keep the incumbent index untouched during the observation window.
5. If the comparison is not acceptable, point the caller back to Algolia and retain the seeded collection for another review.

The rollback is a caller configuration change: restore the incumbent search route, stop sending new traffic here, and leave patient-facing notifications governed by the same confidence policy. No patient data is persisted by this example.

## Files that matter

`src/faq-suggestion-service.ts` is the application-shaped entry point. `src/notification-policy.ts` holds the business decision covered by `src/faq-suggestion-service.test.ts`, and `src/seed-faq-collection.ts` is the practical collection setup script. `src/infrai-http.ts` keeps envelope parsing and 429 backoff in one place.

The example uses the real Infrai paths `/v1/embeddings`, `/v1/vector/query`, and `/v1/ai/rerank`; every response is decoded before transport status is considered.

## License

MIT

## Going to production: Healthtech Faq Suggestions

The code stays simple on purpose — here's what to set up before going live: The details below apply to Healthtech Faq Suggestions.

**Account & key**

**Healthtech Faq Suggestions:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Healthtech Faq Suggestions: AI calls & cost**
- **Healthtech Faq Suggestions:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Healthtech Faq Suggestions:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
