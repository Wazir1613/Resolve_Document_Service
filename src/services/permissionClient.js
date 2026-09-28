// STUB — RBAC Service (Task 5) has no defined contract yet.
// Every route calls this function, so swapping in the real check later
// means editing this one file, not every route.
async function checkPermission(userId, permissionCode)
{
    return true;
}

module.exports = { checkPermission };