export default function Home() {
  return (
    <div className="min-h-screen bg-cinza-preto flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-cinza-branco mb-4">
          IW8 - Sistema de RH
        </h1>
        <p className="text-azul-medio text-lg mb-6">
          Setup concluído com sucesso!
        </p>
        <div className="flex gap-3 justify-center">
          <span className="w-4 h-4 rounded-full bg-laranja"></span>
          <span className="w-4 h-4 rounded-full bg-amarelo"></span>
          <span className="w-4 h-4 rounded-full bg-azul"></span>
          <span className="w-4 h-4 rounded-full bg-azul-medio"></span>
        </div>
      </div>
    </div>
  );
}