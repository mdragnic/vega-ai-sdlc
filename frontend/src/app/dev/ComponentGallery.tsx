import { useEffect, useId, useRef, type ReactNode } from 'react';

import { googleUrl } from '../../assets/brand';
import {
  AppLayout,
  AuthLayout,
  Avatar,
  ButtonPrimary,
  ButtonSecondary,
  FieldError,
  FormError,
  Header,
  HeaderSearch,
  Input,
  Logout,
  NavBar,
  NavMenu,
  Profile,
  RemindMe,
  Spinner,
  TextDivider,
} from '../../components';
import { navSections } from '../../components/NavMenu/NavMenu';
import styles from './ComponentGallery.module.css';
// A local photo for the photo examples: the profile photo cropped from docs/figma/104. Overview.png.
import sampleAvatarUrl from './sample-avatar.png';

function Section({ name, wide = false, children }: { name: string; wide?: boolean; children: ReactNode }) {
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {name}
      </h2>
      <div className={wide ? undefined : styles.column}>{children}</div>
    </section>
  );
}

function Example({ name, children }: { name: string; children: ReactNode }) {
  const captionId = useId();
  return (
    <figure className={styles.example} aria-labelledby={captionId}>
      <figcaption id={captionId} className={styles.caption}>
        {name}
      </figcaption>
      {children}
    </figure>
  );
}

/** Show Password is the user's toggle (#51), not a prop, so the gallery clicks the eye once on mount. */
function ShowPasswordExample() {
  const wrapper = useRef<HTMLDivElement>(null);
  const clicked = useRef(false);
  useEffect(() => {
    if (clicked.current) return;
    clicked.current = true;
    wrapper.current?.querySelector<HTMLButtonElement>('button[aria-label="Show password"]')?.click();
  }, []);

  return (
    <div ref={wrapper}>
      <Input label="Password" type="password" defaultValue="152@@##PAss" />
    </div>
  );
}

// Logging out is task 011; here the button does nothing.
const noLogout = () => undefined;

/** The sidebar parts are drawn for the dark sidebar, so they are shown on it. */
function SidebarPanel({ children }: { children: ReactNode }) {
  return <div className={styles.sidebarPanel}>{children}</div>;
}

/** Screen content taller than the viewport, so the frame scrolls. */
function TallContent() {
  return (
    <>
      <div className={styles.tallBlock}>
        Screen content (tasks 013 onward). Taller than the viewport, so the page scrolls.
      </div>
      <div className={styles.tallBlock}>More screen content.</div>
    </>
  );
}

/**
 * Development-only page with every shared component in every state (/dev/components). Each later
 * shared-component task adds its section; test/app/gallery.test.tsx checks that every component has one.
 */
export function ComponentGallery() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Component gallery</h1>
      <p className={styles.note}>Development only. Focus a field for the Active style (#63).</p>

      <Section name="Input">
        <Example name="Name-Email, empty">
          <Input label="Email Address" type="email" />
        </Example>
        <Example name="Name-Email, placeholder">
          <Input label="Email Address" type="email" placeholder="hello@example.com" />
        </Example>
        <Example name="Name-Email, filled">
          <Input label="Email Address" type="email" defaultValue="johndoe@email.com" />
        </Example>
        <Example name="Name, filled">
          <Input label="Name" defaultValue="Tanzir Rahman" />
        </Example>
        <Example name="Password, masked, with label action">
          <Input
            label="Password"
            type="password"
            defaultValue="password123456"
            labelAction={<a href="#forgot-password">Forgot Password?</a>}
          />
        </Example>
        <Example name="Show Password">
          <ShowPasswordExample />
        </Example>
        <Example name="Field error">
          <Input label="Email Address" type="email" error="Email is required" />
        </Example>
      </Section>

      <Section name="ButtonPrimary">
        <Example name="Default">
          <ButtonPrimary>Login</ButtonPrimary>
        </Example>
        <Example name="Disabled">
          <ButtonPrimary disabled>Login</ButtonPrimary>
        </Example>
        <Example name="Loading">
          <ButtonPrimary loading>Login</ButtonPrimary>
        </Example>
      </Section>

      <Section name="ButtonSecondary">
        <Example name="With icon">
          <ButtonSecondary icon={<img src={googleUrl} alt="" />}>Continue with Google</ButtonSecondary>
        </Example>
        <Example name="Without icon">
          <ButtonSecondary>Continue with Google</ButtonSecondary>
        </Example>
      </Section>

      <Section name="RemindMe">
        <Example name="Checked">
          <RemindMe label="Keep me signed in" defaultChecked />
        </Example>
        <Example name="Unchecked">
          <RemindMe label="Keep me signed in" />
        </Example>
      </Section>

      <Section name="FieldError">
        <Example name="Message">
          <FieldError>Email is required</FieldError>
        </Example>
      </Section>

      <Section name="FormError">
        <Example name="Message">
          <FormError>Email or password is incorrect</FormError>
        </Example>
      </Section>

      <Section name="Spinner">
        <Example name="Default">
          <Spinner />
        </Example>
      </Section>

      <Section name="TextDivider">
        <Example name="Sign in">
          <TextDivider>or sign in with</TextDivider>
        </Example>
        <Example name="Sign up">
          <TextDivider>or sign up with</TextDivider>
        </Example>
      </Section>

      <Section name="AuthLayout" wide>
        <Example name="Page frame">
          <AuthLayout className={styles.authOffset}>
            <p className={styles.note}>The screen content goes here.</p>
          </AuthLayout>
        </Example>
      </Section>

      <Section name="NavMenu">
        <Example name="Active">
          <SidebarPanel>
            {navSections.map((section) => (
              <NavMenu key={section} section={section} active />
            ))}
          </SidebarPanel>
        </Example>
        <Example name="Inactive">
          <SidebarPanel>
            {navSections.map((section) => (
              <NavMenu key={section} section={section} />
            ))}
          </SidebarPanel>
        </Example>
        <Example name="Hover">
          <p className={styles.note}>Point at an item: Inactive items show Hover, as in the Figma component set.</p>
          <SidebarPanel>
            {navSections.map((section) => (
              <NavMenu key={section} section={section} />
            ))}
          </SidebarPanel>
        </Example>
      </Section>

      <Section name="Logout">
        <Example name="Default">
          <SidebarPanel>
            <Logout onLogout={noLogout} />
          </SidebarPanel>
        </Example>
      </Section>

      <Section name="Avatar">
        <Example name="Photo">
          <SidebarPanel>
            <Avatar fullName="Tanzir Rahman" photoUrl={sampleAvatarUrl} />
          </SidebarPanel>
        </Example>
        <Example name="Initials, two words">
          <SidebarPanel>
            <Avatar fullName="Tanzir Rahman" />
          </SidebarPanel>
        </Example>
        <Example name="Initials, one word">
          <SidebarPanel>
            <Avatar fullName="Marko" />
          </SidebarPanel>
        </Example>
      </Section>

      <Section name="Profile">
        <Example name="With photo">
          <SidebarPanel>
            <Profile fullName="Tanzir Rahman" photoUrl={sampleAvatarUrl} />
          </SidebarPanel>
        </Example>
        <Example name="Initials, two words">
          <SidebarPanel>
            <Profile fullName="Tanzir Rahman" />
          </SidebarPanel>
        </Example>
        <Example name="Initials, one word">
          <SidebarPanel>
            <Profile fullName="Marko" />
          </SidebarPanel>
        </Example>
      </Section>

      <Section name="NavBar">
        <Example name="Overview active">
          <NavBar activeSection="overview" fullName="Tanzir Rahman" onLogout={noLogout} />
        </Example>
      </Section>

      <Section name="HeaderSearch">
        <Example name="Empty">
          <HeaderSearch />
        </Example>
      </Section>

      <Section name="Header" wide>
        <Example name="With greeting">
          <div className={styles.headerFrame}>
            <Header greetingName="Tanzir" today="2023-05-19" />
          </div>
        </Example>
        <Example name="Without greeting">
          <div className={styles.headerFrame}>
            <Header today="2023-05-19" />
          </div>
        </Example>
      </Section>

      <Section name="AppLayout" wide>
        <Example name="Like 104: Overview active, with greeting">
          <AppLayout
            navBar={<NavBar activeSection="overview" fullName="Tanzir Rahman" onLogout={noLogout} />}
            header={<Header greetingName="Tanzir" today="2023-05-19" />}
          >
            <TallContent />
          </AppLayout>
        </Example>
        <Example name="Like 105: Balances active, no greeting">
          <AppLayout
            navBar={<NavBar activeSection="balances" fullName="Tanzir Rahman" onLogout={noLogout} />}
            header={<Header today="2023-05-19" />}
          >
            <TallContent />
          </AppLayout>
        </Example>
      </Section>
    </div>
  );
}
