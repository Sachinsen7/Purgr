import { JSX } from 'solid-js'


export const animationClasses = {
   
    fadeIn: 'animate-in fade-in duration-500',
    fadeOut: 'animate-out fade-out duration-300',

  
    slideInFromLeft: 'animate-in slide-in-from-left duration-500 ease-out',
    slideInFromRight: 'animate-in slide-in-from-right duration-500 ease-out',
    slideInFromTop: 'animate-in slide-in-from-top duration-500 ease-out',
    slideInFromBottom: 'animate-in slide-in-from-bottom duration-500 ease-out',

   
    zoomIn: 'animate-in zoom-in duration-400 ease-out',
    zoomOut: 'animate-out zoom-out duration-300',

    scaleOnHover: 'transition-transform duration-300 hover:scale-105',
    scaleOnActive: 'transition-transform duration-200 active:scale-95',
}

export const pageTransitionClasses =
    'animate-in fade-in duration-500 ease-out'

export const cardEnterClasses =
    'animate-in fade-in slide-in-from-bottom duration-500 ease-out fill-mode-both'

export const buttonInteractionClasses =
    'transition-all duration-200 hover:shadow-lg active:scale-95'
