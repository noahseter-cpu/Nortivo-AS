# Actual data handling — 1.0 candidate

This is an implementation record and policy draft basis, not a published privacy policy or legal approval.

Arc stores the chosen name, profile measurements and age, optional calorie-estimate inputs, financial entries, food/activity logs, notes, goals, categories, favorites, language and appearance on the device. There is no Arc account server, analytics, advertising SDK, bank connection, watch connection or remote diary synchronization. IndexedDB is local storage, not application-level encryption. Android OS cloud backup/device transfer is disabled in the manifest; device security still matters.

The user can edit/delete entries, export an unencrypted JSON backup or CSV, restore a validated backup, or explicitly delete personal data in Settings. Android export opens the native share sheet; the user chooses the destination. Files shared to another app then fall under that app's handling. Canceling sharing is not an external backup. Deleting app/browser data or uninstalling can remove local records.

Matvaretabellen's public bilingual dataset is bundled for local search. Open Food Facts text/barcode search sends query, selected market and language to its service. The web edition uses its same-origin read-only adapter; the native app contacts OFF directly. The receiving network services see normal metadata such as IP address. Loading an external product image contacts its image host. Public source cache is distinct from private records. Arc does not upload a user's profile, notes, financial history, custom foods or diary to these databases.

Camera access is requested only when the user opens scanning. Decoding is local; camera frames are not uploaded. Typed barcode and text search remain available after refusal. First-use web language uses the hosting request's country indication; native Android uses device region. The selected language and reason are saved, not a Play Billing country/profile. No GPS or location tracking is added.

Before a public store release, the owner must supply the legal operator/contact, publish an accessible policy URL, verify hosting/provider logging and retention, and complete relevant store declarations. Applicable references checked for this candidate: [Google Play user data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en), [Google Play health apps policy](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en). Neither this text nor successful tests establish compliance approval.
