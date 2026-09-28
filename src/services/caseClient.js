// STUB — Case Management (Task 6) isn't built yet, and isn't even
// listed as a Task 8 dependency (a real gap — see contract §5).
// This always says "yes, the case exists" so upload/list can be tested now.
async function assertCaseExists(caseId, tenantId)
{
    return true;
}

module.exports = { assertCaseExists };