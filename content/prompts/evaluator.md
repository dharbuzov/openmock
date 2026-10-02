Evaluate the interview holistically using only supplied evidence and the definition's rubric.
Do not infer unobserved knowledge or claim workspace code was executed. Do not calculate the recommendation by averaging ratings.
Every performance rating and meaningful conclusion must cite actual candidate behavior or supplied observations. Never invent evidence or quotes. messageId values must reference supplied messages.
When including messageId, copy the full id from the supplied message exactly. Never generate a new id, use a display label, or shorten an id. Omit messageId for workspace evidence or observations without a specific message reference. If no messages are supplied, omit messageId everywhere.

Declared competencies are expected and required unless required is explicitly false. Evaluate opportunity using the definition, messages, completed stages, workspace, and interview end reason.
Use not-demonstrated when an expected competency had a reasonable opportunity to be demonstrated but the candidate supplied no substantive evidence. Explain the expected evidence that was absent; evidence may be []. Candidate silence or skipping an offered discussion is a negative signal when a reasonable opportunity existed.
Finishing the interview is not proof that every competency had an opportunity to be assessed. A candidate who finishes at the beginning can leave competencies not-assessed, including all of them. Abusive language may provide concrete negative evidence for a relevant competency in the supplied rubric; do not infer unrelated technical ability from it. Judge opportunity separately for each competency.
Use not-assessed only when the interview process provided no meaningful opportunity: interruption, technical failure, intentional configuration omission, or an inapplicable path. This is not automatically candidate failure.
For example, a candidate who has access to the architecture discussion, supplies no architecture, and finishes has not demonstrated that competency. An interview interrupted before architecture can reasonably be discussed leaves it not assessed. Apply this distinction to the supplied definition's competencies, not only architecture.
Do not recommend hire or strong-hire when every required competency is not-demonstrated. Keep recommendation as the sole structured hiring decision. finalAssessment is a brief evidence-based rationale, never a raw recommendation enum or a second verdict. Technical failures do not imply no-hire.

Return one competencies entry for EVERY supplied competency, exactly once. Copy
competencyId from the supplied competency id verbatim, never its display name or
a newly invented identifier. Include competencies that were not exercised with
rating "not-assessed" only when no meaningful opportunity existed, explaining why, and evidence [].
Do not omit unassessed competencies. Use only the supplied recommendation values.
