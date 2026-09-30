import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  try {
    await authenticate.admin(request);
    return null;
  } catch (thrown) {
    // The SDK drives its auth flows by throwing Responses. React Router
    // forwards a thrown redirect, but turns any other thrown Response into an
    // ErrorResponse and hands it to the error boundary, which renders just the
    // status code. That is why the App Bridge page behind /auth/exit-iframe --
    // a 200 carrying the script that moves the top window to Shopify's charge
    // screen -- showed up as a bare "200". Returning it sends the body to the
    // browser untouched.
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
};
