import { Transition } from "@headlessui/react";
import { Fragment, ReactNode, useEffect, useState } from "react";
import { useUserSession } from "@vertesia/ui/session";


interface SplashScreenProps {
    icon?: ReactNode;
}
export function SplashScreen({ icon: Icon }: SplashScreenProps) {
    const { isLoading } = useUserSession();
    const [show, setShow] = useState(true);

    useEffect(() => {
        if (!isLoading) {
            setShow(false)
        }
        // setTimeout(() => {
        //     setShow(false)
        // }, 2000)
    }, [isLoading])

    // 300 500 700 1000
    return (
        <Transition
            appear={true}
            show={show}
            as={Fragment}
            unmount
            leave="transition ease-in duration-500"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
        >
            <div style={{ zIndex: 999999, position: 'fixed', inset: 0 }} className='fixed inset-x-0 inset-y-0'>
                <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }} className="flex w-full h-full items-center justify-center">
                    <div className="animate-[spin_4s_linear_infinite]">
                        <div className='animate-pulse rounded-full bg-transparent'>
                            {Icon || <LoadingIcon />}
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    )
}

function LoadingIcon() {
    const stopColor1 = "currentColor";
    const stopColor2 = "currentColor";
    // const stopColor1 = "#4F46E5";
    // const stopColor2 = "#4F46E5";
    return (
        <svg
            width="32"
            height="32"
            className="w-8 h-8 text-indigo-600"
            viewBox="0 0 50 50"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="spinner-gradient" x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stopColor1} stopOpacity="1" />
                    <stop offset="100%" stopColor={stopColor2} stopOpacity="0" />
                </linearGradient>
            </defs>
            <circle
                cx="25"
                cy="25"
                r="20"
                stroke="url(#spinner-gradient)"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
            />
        </svg>
    )
}