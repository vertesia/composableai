import { SignupData } from "@vertesia/common";
import { Button, Input, VSelectBox, SelectStack } from "@vertesia/ui/core";
import { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { getFirebaseAuth } from "@vertesia/ui/session";


interface CompanySizeOption {
    id: number;
    label: string;
}

const companySizeOptions: CompanySizeOption[] = [
    { id: 1, label: "1-10 employees" },
    { id: 11, label: "11-100 employees" },
    { id: 101, label: "101-1000 employees" },
    { id: 1001, label: "1001-5000 employees" },
    { id: 5001, label: "5000+ employees" },
];

const accountTypeOptions = [
    {
        id: "personal",
        label: "Personal",
        description: "For personal use, or for a small team.",
    },
    {
        id: "company",
        label: "Company",
        description: "For a company or organization.",
    },
];

const projectMaturityOptions = [
    { id: "testing", label: "Just Testing or Evaluating LLMs" },
    { id: "exploring", label: "Actively Exploring LLMs on a Project" },
    { id: "using", label: "Already Using LLMs in Production" },
    { id: "migrating", label: "Migrating to different LLMs" },
    { id: "other", label: "Other" },
];

interface SignupFormProps {
    onSignup: (data: SignupData, fbToken: string) => void;
    goBack: () => void;
}

export default function SignupForm({ onSignup, goBack }: SignupFormProps) {
    const [accountType, setAccountType] = useState<string | undefined>(undefined);
    const [companySize, setCompanySize] = useState<CompanySizeOption | undefined>(undefined);
    const [companyName, setCompanyName] = useState<string | undefined>(undefined);
    const [companyWebsite, setCompanyWebsite] = useState<string | undefined>(undefined);
    const [projectMaturity, setProjectMaturity] = useState<string | undefined>(undefined);
    const [fbUser, setFbUser] = useState<User | undefined>(undefined);

    const [error, setError] = useState<string | undefined>(undefined);
    const isCompany = accountType === "company";

    useEffect(() => {
        const user = getFirebaseAuth().currentUser;
        if (!user) {
            console.error('No user found');
            return;
        }
        setFbUser(user);
    }, [fbUser]);

    const isValid = () => {
        if (!accountType) {
            setError("Please select an account type");
            return false;
        }
        if (isCompany && !companyName) {
            setError("Please enter an organization name");
            return false;
        }

        if (isCompany && !companySize) {
            setError("Please select a company size");
            return false;
        }

        return true
    }


    const onSubmit = async () => {
        if (!isValid()) return;
        if (!accountType) return;

        const signupData = {
            accountType: accountType,
            companyName: companyName,
            companySize: companySize?.id,
            companyWebsite: companyWebsite,
            maturity: projectMaturity,
        };

        window.localStorage.setItem("composableSignupData", JSON.stringify(signupData));

        const fbToken = await getFirebaseAuth().currentUser?.getIdToken();
        console.log('Got firebase token', getFirebaseAuth(), fbToken);
        if (!fbToken) {
            console.error('No firebase token found');
            return;
        }

        onSignup(signupData, fbToken);

    }

    return (
        <div className="flex flex-col space-y-2">
            <div className="prose">
                <p className="prose text-sm text-muted pt-4">
                    Welcome to Vertesia, {fbUser?.displayName} ({fbUser?.email}).
                    Please tell us a little bit about yourself and you&apos;ll be on your way.
                    No credit card is required.
                </p>
                {error &&
                    <div className="text-destructive">{error}</div>
                }
            </div>
            <FormItem label="Account Type">
                <SelectStack
                    options={accountTypeOptions}
                    selected={accountTypeOptions.find((option) => option.id === accountType)}
                    onSelect={(option) => setAccountType(option.id)}
                />
            </FormItem>
            {isCompany &&
                <>
                    <FormItem label="Company Size">
                        <VSelectBox className="w-full border border-accent bg-muted"
                            value={companySize}
                            options={companySizeOptions}
                            onChange={setCompanySize}
                            optionLabel={(option) => option?.label}
                            placeholder='Select Company Size'
                        />
                    </FormItem>
                    <FormItem label="Company Name">
                        <Input value={companyName} onChange={setCompanyName} type="text" required={true} />
                    </FormItem>
                    <FormItem label="Company Website">
                        <Input value={companyWebsite} onChange={setCompanyWebsite} type="text" />
                    </FormItem>
                </>
            }
            <FormItem label="Project Maturity">
                <VSelectBox className="w-full border border-accent bg-muted"
                    options={projectMaturityOptions}
                    value={projectMaturityOptions.find((option) => option.id === projectMaturity)}
                    optionLabel={(option) => option?.label}
                    placeholder='Select Project Maturity'
                    onChange={(option) => setProjectMaturity(option?.id)}
                />
            </FormItem>
            <div className="pt-8 flex flex-col">
                <Button variant="primary" onClick={onSubmit} size="xl">
                    <span className="text-lg">Sign Up</span>
                </Button>
                <Button variant="ghost" size="xl" className="mt-4" onClick={goBack}>
                    <span className="">Wrong account, go back</span>
                </Button>
            </div>
        </div>
    );
}

function FormItem({ label, children }: { label: string, children: React.ReactNode }) {

    return (
        <div className="flex flex-col space-y-2 pt-4">
            <div className="text-sm text-muted">{label}</div>
            {children}
        </div>
    )

}
