import { loadFont as loadMitr } from '@remotion/google-fonts/Mitr'
import { loadFont as loadLato } from '@remotion/google-fonts/Lato'
import { loadFont as loadJost } from '@remotion/google-fonts/Jost'

// Carrega as mesmas famílias do app (Mitr, Lato, Jost). O Remotion espera as
// fontes carregarem antes de desenhar cada quadro.
loadMitr('normal', { weights: ['300', '400'], subsets: ['latin', 'latin-ext'] })
loadLato('normal', { weights: ['400', '700'], subsets: ['latin', 'latin-ext'] })
loadJost('normal', { weights: ['400', '500'], subsets: ['latin', 'latin-ext'] })
