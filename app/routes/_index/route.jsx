import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const meta = () => [
  { title: "Wallify IG — Instagram Feed for Shopify" },
  {
    name: "description",
    content:
      "Display your Instagram posts and reels on your Shopify storefront as a modern, customizable feed. No code required.",
  },
];

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Your Instagram, on your storefront</h1>
        <p className={styles.text}>
          Wallify IG brings your Instagram posts and reels into your Shopify
          store as a modern feed — so visitors see the social proof that turns
          browsers into buyers.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Set up without code</strong>. Connect your Instagram
            Business or Creator account, sync your media, and drop the feed into
            any section from the Shopify theme editor.
          </li>
          <li>
            <strong>Match your storefront</strong>. Choose a slider or grid
            layout, set column counts per device, and tune spacing, corners, and
            colors until the feed looks like it was always part of your theme.
          </li>
          <li>
            <strong>See what converts</strong>. Track views and clicks per post,
            pin the content you want first, hide what you do not, and attach
            products to the posts that sell them.
          </li>
        </ul>
      </div>
    </div>
  );
}
