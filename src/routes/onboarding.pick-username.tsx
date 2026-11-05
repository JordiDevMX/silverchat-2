import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthFrame, InlineError } from "@/features/auth/components";
import { usePickUsername } from "@/features/auth/hooks/usePickUsername";
export function PickUsernamePage() {
  const { register, errors, isSubmitting, username, submit } = usePickUsername();
  return (
    <AuthFrame
      title="Pick your username"
      subtitle="This is how others will find you. You can’t change it easily."
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="username">Username</label>
        <div className="input-with-icon">
          <span aria-hidden="true">@</span>
          <Input
            id="username"
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
            aria-invalid={!!errors.username}
            aria-describedby="username-help username-error"
            {...register("username")}
          />
        </div>
        <p id="username-help" className="quiet-note">
          Your handle: @{username || "your_name"}
        </p>
        <div id="username-error">
          <InlineError>{errors.username?.message || errors.root?.message}</InlineError>
        </div>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving…" : "Continue"}
        </Button>
      </form>
    </AuthFrame>
  );
}
