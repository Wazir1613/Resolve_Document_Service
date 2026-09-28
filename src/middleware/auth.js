// STUB — replace with real JWT verification once Authentication is reachable.
// For now every request is treated as this one fake logged-in user.
function fakeAuth(req, res, next)
{
    req.user =
        {
            tenantId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            userId: "7c9e6679-7425-40de-944b-e07fc1f90ae7"
        };
    next();
}

module.exports = fakeAuth;