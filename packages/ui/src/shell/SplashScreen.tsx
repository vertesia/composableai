import { Transition } from "@headlessui/react";
import { Fragment, useEffect, useState } from "react";
import { useUserSession } from "@vertesia/ui/session";


interface SplashScreenProps {
}
export function SplashScreen({ }: SplashScreenProps) {
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
            <div style={{ zIndex: 999999 }} className='fixed inset-x-0 inset-y-0'>
                <div className="flex w-full h-full items-center justify-center">
                    <div className="animate-[spin_4s_linear_infinite]">
                        <img src='/icon.svg' className='w-10 h-auto animate-pulse rounded-full' />
                    </div>
                </div>
            </div>
        </Transition>
    )
}