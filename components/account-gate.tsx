import * as Auth from "@/lib/_core/auth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type AuthMode = "login" | "signup";

export function AccountGate({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
  });

  const refreshAccount = async () => {
    await utils.auth.me.invalidate();
    await meQuery.refetch();
  };

  const signOut = async () => {
    await Auth.removeSessionToken();
    await Auth.clearUserInfo();
    await refreshAccount();
  };

  if (meQuery.isLoading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color="#0EA5E9" />
        <Text style={styles.mutedText}>Checking account</Text>
      </View>
    );
  }

  const user = meQuery.data;

  if (!user) {
    return <AccountScreen onSignedIn={refreshAccount} />;
  }

  if (user.accountStatus === "pending") {
    return <PendingActivationScreen onRefresh={refreshAccount} onSignOut={signOut} />;
  }

  if (user.accountStatus === "suspended" || user.accountStatus === "closed") {
    return <BlockedAccountScreen status={user.accountStatus} onSignOut={signOut} />;
  }

  return <>{children}</>;
}

function AccountScreen({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [businessName, setBusinessName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const signupMutation = trpc.auth.signup.useMutation();
  const loginMutation = trpc.auth.login.useMutation();
  const isSignup = mode === "signup";
  const isBusy = signupMutation.isPending || loginMutation.isPending;

  const handleSubmit = async () => {
    setNotice(null);
    try {
      const result = isSignup
        ? await signupMutation.mutateAsync({ businessName, name, email, phone, password })
        : await loginMutation.mutateAsync({ email, password });

      await Auth.setSessionToken(result.sessionToken);
      await Auth.setUserInfo({
        ...result.user,
        lastSignedIn: new Date(result.user.lastSignedIn),
      });
      setNotice(
        result.user.accountStatus === "pending"
          ? "Account created. It is waiting for admin activation."
          : "Signed in successfully.",
      );
      await onSignedIn();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Account request failed.";
      setNotice(message);
      Alert.alert("Dynamigo Logistics", message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollScreen} keyboardShouldPersistTaps="handled">
      <View style={styles.authCard}>
        <Text style={styles.eyebrow}>Dynamigo Logistics</Text>
        <Text style={styles.title}>{isSignup ? "Create account" : "Sign in"}</Text>
        <Text style={styles.copy}>
          {isSignup
            ? "Create your business account. New customers stay pending until Dynamigo activates them."
            : "Sign in to your business routes and saved settings."}
        </Text>

        {isSignup ? (
          <>
            <Field label="Business name" value={businessName} onChangeText={setBusinessName} placeholder="e.g., Scottish Sofa Boys" />
            <Field label="Your name" value={name} onChangeText={setName} placeholder="Name" />
            <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="Mobile number" keyboardType="phone-pad" />
          </>
        ) : null}

        <Field label="Email" value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="Minimum 8 characters" secureTextEntry />

        {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isBusy && styles.disabled]} onPress={handleSubmit} disabled={isBusy}>
          <Text style={styles.primaryButtonText}>{isBusy ? "Please wait..." : isSignup ? "Create account" : "Sign in"}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => {
            setNotice(null);
            setMode(isSignup ? "login" : "signup");
          }}
        >
          <Text style={styles.secondaryButtonText}>{isSignup ? "Already have an account? Sign in" : "Need an account? Create one"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function PendingActivationScreen({ onRefresh, onSignOut }: { onRefresh: () => void; onSignOut: () => void }) {
  return (
    <View style={styles.centerScreen}>
      <View style={styles.authCard}>
        <Text style={styles.eyebrow}>Account pending</Text>
        <Text style={styles.title}>Waiting for activation</Text>
        <Text style={styles.copy}>
          Your account has been created. Contact Dynamigo Logistics after your WhatsApp call and an admin will activate your trial.
        </Text>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={onRefresh}>
          <Text style={styles.primaryButtonText}>Check again</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={onSignOut}>
          <Text style={styles.secondaryButtonText}>Use a different account</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BlockedAccountScreen({ status, onSignOut }: { status: "suspended" | "closed"; onSignOut: () => void }) {
  return (
    <View style={styles.centerScreen}>
      <View style={styles.authCard}>
        <Text style={styles.eyebrow}>Account unavailable</Text>
        <Text style={styles.title}>{status === "suspended" ? "Account suspended" : "Account closed"}</Text>
        <Text style={styles.copy}>Contact Dynamigo Logistics if you think this needs changing.</Text>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={onSignOut}>
          <Text style={styles.secondaryButtonText}>Use a different account</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none";
  secureTextEntry?: boolean;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#050A14",
    padding: 20,
    gap: 14,
  },
  scrollScreen: {
    flexGrow: 1,
    justifyContent: "center",
    backgroundColor: "#050A14",
    padding: 20,
  },
  authCard: {
    backgroundColor: "#0F172A",
    borderRadius: 24,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  eyebrow: {
    color: "#38BDF8",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
  },
  copy: {
    color: "#CBD5E1",
    fontSize: 15,
    lineHeight: 22,
  },
  mutedText: {
    color: "#CBD5E1",
    textAlign: "center",
    fontWeight: "700",
  },
  noticeText: {
    color: "#BAE6FD",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  label: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "800",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#0F172A",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  primaryButton: {
    backgroundColor: "#1E5EFF",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: "rgba(148, 163, 184, 0.16)",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(203, 213, 225, 0.24)",
  },
  secondaryButtonText: {
    color: "#E2E8F0",
    fontSize: 15,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
