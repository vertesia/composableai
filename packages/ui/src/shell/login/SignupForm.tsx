import { SignupData } from "@vertesia/common";
import { Button, Input, SelectBox, SelectStack } from "@vertesia/ui/core";
import { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { getFirebaseAuth } from "@vertesia/ui/session";
import { useUITranslation } from '../../i18n/index.js';


interface CompanySizeOption {
    id: number;
    label: string;
}

interface SignupFormProps {
    onSignup: (data: SignupData, fbToken: string) => void;
    goBack: () => void;
}

export default function SignupForm({ onSignup, goBack }: SignupFormProps) {
    const { t } = useUITranslation();
    const [accountType, setAccountType] = useState<string | undefined>(undefined);
    const [companySize, setCompanySize] = useState<CompanySizeOption | undefined>(undefined);
    const [companyName, setCompanyName] = useState<string | undefined>(undefined);
    const [companyWebsite, setCompanyWebsite] = useState<string | undefined>(undefined);
    const [projectMaturity, setProjectMaturity] = useState<string | undefined>(undefined);
    const [fbUser, setFbUser] = useState<User | undefined>(undefined);

    const [error, setError] = useState<string | undefined>(undefined);
    const isCompany = accountType === "company";

    const companySizeOptions: CompanySizeOption[] = [
        { id: 1, label: t('signup.size1to10') },
        { id: 11, label: t('signup.size11to100') },
        { id: 101, label: t('signup.size101to1000') },
        { id: 1001, label: t('signup.size1001to5000') },
        { id: 5001, label: t('signup.size5000plus') },
    ];

    const accountTypeOptions = [
        {
            id: "personal",
            label: t('signup.personal'),
            description: t('signup.personalDescription'),
        },
        {
            id: "company",
            label: t('signup.company'),
            description: t('signup.companyDescription'),
        },
    ];

    const projectMaturityOptions = [
        { id: "testing", label: t('signup.justTesting') },
        { id: "exploring", label: t('signup.activelyExploring') },
        { id: "using", label: t('signup.alreadyUsing') },
        { id: "migrating", label: t('signup.migratingLLMs') },
        { id: "other", label: t('signup.other') },
    ];

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
            setError(t('signup.pleaseSelectAccountType'));
            return false;
        }
        if (isCompany && !companyName) {
            setError(t('signup.pleaseEnterOrgName'));
            return false;
        }

        if (isCompany && !companySize) {
            setError(t('signup.pleaseSelectCompanySize'));
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
                    {t('signup.welcomeMessage', { name: fbUser?.displayName, email: fbUser?.email })}
                </p>
                {error &&
                    <div className="text-destructive">{error}</div>
                }
            </div>
            <FormItem label={t('signup.accountType')}>
                <SelectStack
                    options={accountTypeOptions}
                    selected={accountTypeOptions.find((option) => option.id === accountType)}
                    onSelect={(option) => setAccountType(option.id)}
                />
            </FormItem>
            {isCompany &&
                <>
                    <FormItem label={t('signup.companySize')}>
                        <SelectBox className="w-full border border-accent bg-muted"
                            value={companySize}
                            options={companySizeOptions}
                            onChange={setCompanySize}
                            optionLabel={(option) => option?.label}
                            placeholder={t('signup.selectCompanySize')}
                        />
                    </FormItem>
                    <FormItem label={t('signup.companyName')}>
                        <Input value={companyName} onChange={setCompanyName} type="text" required={true} />
                    </FormItem>
                    <FormItem label={t('signup.companyWebsite')}>
                        <Input value={companyWebsite} onChange={setCompanyWebsite} type="text" />
                    </FormItem>
                </>
            }
            <FormItem label={t('signup.projectMaturity')}>
                <SelectBox className="w-full border border-accent bg-muted"
                    options={projectMaturityOptions}
                    value={projectMaturityOptions.find((option) => option.id === projectMaturity)}
                    optionLabel={(option) => option?.label}
                    placeholder={t('signup.selectProjectMaturity')}
                    onChange={(option) => setProjectMaturity(option?.id)}
                />
            </FormItem>
            <div className="pt-8 flex flex-col">
                <Button variant="primary" onClick={onSubmit} size="xl">
                    <span className="text-lg">{t('signup.signUp')}</span>
                </Button>
                <Button variant="ghost" size="xl" className="mt-4" onClick={goBack}>
                    <span className="">{t('signup.wrongAccountGoBack')}</span>
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
