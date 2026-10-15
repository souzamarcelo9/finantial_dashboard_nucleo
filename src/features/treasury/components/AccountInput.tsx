import { useBankAccounts } from "../../../store/treasuryStore";

interface AccountInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Campo "Conta/Carteira" com as contas da Tesouraria sugeridas.
 *
 * É um input com datalist, não um select: os lançamentos antigos têm nomes de
 * conta em texto livre, e um select obrigaria a recadastrar tudo antes de
 * poder lançar. Assim as contas cadastradas aparecem como sugestão e o nome
 * digitado continua válido.
 */
export const AccountInput = ({
  id,
  value,
  onChange,
  placeholder,
  className,
}: AccountInputProps) => {
  const accounts = useBankAccounts();
  const listId = `${id}-accounts`;

  return (
    <>
      <input
        id={id}
        type="text"
        list={accounts.length > 0 ? listId : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
      {accounts.length > 0 && (
        <datalist id={listId}>
          {accounts
            .filter((account) => account.active)
            .map((account) => (
              <option key={account.id} value={account.name} />
            ))}
        </datalist>
      )}
    </>
  );
};
